from __future__ import unicode_literals
from __future__ import division
from __future__ import absolute_import


"""core.py: part of autoremove plus."""

__author__      = "Jools"
__email__       = "springjools@gmail.com"
__copyright__   = "Copyright 2019"

# Basic plugin template created by:
# Copyright (C) 2008 Martijn Voncken <mvoncken@gmail.com>
# Copyright (C) 2007-2009 Andrew Resch <andrewresch@gmail.com>
# Copyright (C) 2009 Damien Churchill <damoxc@gmail.com>
#
# Deluge is free software.
#
# You may redistribute it and/or modify it under the terms of the
# GNU General Public License, as published by the Free Software
# Foundation; either version 3 of the License, or (at your option)
# any later version.
#
# deluge is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
# See the GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with deluge.    If not, write to:
#   The Free Software Foundation, Inc.,
#   51 Franklin Street, Fifth Floor
#   Boston, MA  02110-1301, USA.
#
#    In addition, as a special exception, the copyright holders give
#    permission to link the code of portions of this program with the OpenSSL
#    library.
#    You must obey the GNU General Public License in all respects for all of
#    the code used other than OpenSSL. If you modify file(s) with this
#    exception, you may extend this exception to your version of the file(s),
#    but you are not obligated to do so. If you do not wish to do so, delete
#    this exception statement from your version. If you delete this exception
#    statement from all source files in the program, then also delete it here.
#
#from past.utils import old_div
from deluge.log import LOG as log
from deluge.plugins.pluginbase import CorePluginBase
import deluge.component as component
import deluge.configmanager
from deluge.core.rpcserver import export
from .mediaserver import Mediaserver
from twisted.internet import reactor
from twisted.internet.task import LoopingCall, deferLater

import time
import logging
log = logging.getLogger(__name__)

DEFAULT_PREFS = {
    'max_seeds': 0,
    'filter': 'func_ratio',
    'count_exempt': False,
    'remove_data': False,
    'trackers': [],
    'labels': [],
    'min': 0.0,
    'interval': 0.5,
    'sel_func': 'and',
    'filter2': 'func_added',
    'min2': 0.0,
    'hdd_space': -1.0,
    'remove': True,
    'enabled': False,
    'tracker_rules': {},
    'label_rules': {},
    'rule_1_enabled': True,
    'rule_2_enabled': True,
    "enable_lidarr": False,
    "enable_radarr": False,
    "enable_sonarr": False,
    "seed_remove_data": False,
    "pause_seed": False,  
    "seedtime_limit": 120,
    "seedtime_pause": 48  
}

def _get_ratio(i_t):
    (i, t) = i_t
    log.debug("Get ratio: i = {}, t = {}".format(i,t))
    return t.get_ratio()

def _time_last_transfer(i_t):
    (i, t) = i_t
    try:
        # time since last transfer (upload/download) in hours
        time_since_last_transfer = round(t.get_status(['time_since_transfer'])['time_since_transfer'] / 3600.0,2)
    except Exception as e:
        log.error("Unable to get torrent property:{}".format(e))
        return False
    
    return time_since_last_transfer

def _age_in_days(i_t):
    (i, t) = i_t
    now = time.time()
    added = t.get_status(['time_added'])['time_added']
    log.debug("Now = {}, added = {}".format(now,added))
    age_in_days = round((now - added)/86400.0,2) # age in days
    log.debug("Returning age: {}".format(age_in_days))
    return age_in_days

def _time_seen_complete(i_t):
    (i, t) = i_t
    now = time.time()
    try:
      seen_complete = t.get_status(['last_seen_complete'])['last_seen_complete']
    except Exception as e:
      log.error("Unable to get torrent property:{}".format(e))
      return False
      
    if not seen_complete: return False
    
    log.debug("Seen complete on: {}, now = {}".format(seen_complete,now))
    time_last_seen_complete = round((now - seen_complete)/3600.0,2) # time in hours
    log.debug("Returning time since seen complete: {}".format(time_last_seen_complete))
    return time_last_seen_complete

# Add key label also to get_remove_rules():205
filter_funcs = {
    'func_ratio': _get_ratio,
    'func_added': _age_in_days,
    'func_seed_time': lambda p: round(p[1].get_status(['seeding_time'])['seeding_time'] / 3600.0,2),
    'func_seeders': lambda p: p[1].get_status(['total_seeds'])['total_seeds'],
    'func_availability': lambda p: p[1].get_status(['distributed_copies'])['distributed_copies'],
    'func_time_since_transfer': _time_last_transfer,
    'func_time_seen_complete': _time_seen_complete    
}

sel_funcs = {
    'and': lambda tup: tup[0] and tup[1],
    'or': lambda tup: tup[0] or tup[1],
    'xor': lambda tup: (tup[0] and not tup[1]) or (not tup[0] and tup[1])
}

class Core(CorePluginBase):

    def enable(self):
        log.debug("AutoRemovePlus: Enabled")

        self.config = deluge.configmanager.ConfigManager(
            "autoremoveplus.conf",
            DEFAULT_PREFS
        )
        self.torrent_states = deluge.configmanager.ConfigManager(
            "autoremoveplusstates.conf",
            {}
        )

        # Safe after loading to have a default configuration if no gtkui
        self.config.save()
        self.torrent_states.save()

        # it appears that if the plugin is enabled on boot then it is called
        # before the torrents are properly loaded and so periodicScan receives an
        # empty list. So we must listen to SessionStarted for when deluge boots
        #  but we still have apply_now so that if the plugin is enabled
        # mid-program periodicScan is still run
        self.looping_call = LoopingCall(self.periodicScan)
        deferLater(reactor, 5, self.start_looping)
        try:
          apikey_sonarr = self.config['api_sonarr']
          apikey_radarr = self.config['api_radarr']
          apikey_lidarr = self.config['api_lidarr']
          use_sonarr    = self.config['enable_sonarr']
          use_radarr    = self.config['enable_radarr']
          use_lidarr    = self.config['enable_lidarr']
          server        = self.config['server_url']
        except KeyError as e:
          log.warning("Unable to read server config, so disabling sonarr/radarr/lidarr for now. Missing key: {}".format(e))
          use_sonarr    = False
          use_radarr    = False
          use_lidarr    = False
          apikey_sonarr = None
          apikey_radarr = None
          apikey_lidarr = None
          server        = None
          
        log.debug("Server config: Sonarr: enabled={},key={}, Radarr: enabled={}, key={}, Lidarr: enabled={}, key={}, Server: url={}".format(use_sonarr,apikey_sonarr,use_radarr,apikey_radarr,use_lidarr,apikey_lidarr,server))
        
        self.sonarr = Mediaserver(server,apikey_sonarr,'sonarr')
        self.lidarr = Mediaserver(server,apikey_lidarr,'lidarr')
        self.radarr = Mediaserver(server,apikey_radarr,'radarr')  
        self.accepted_labels = ['tv-sonarr','radarr','lidarr']
        self.torrentmanager = component.get("TorrentManager")
                       
    def disable(self):
        if self.looping_call.running:
            self.looping_call.stop()

    def update(self):
        pass

    def start_looping(self):
        log.info('check interval loop starting')
        self.looping_call.start(self.config['interval'] * 3600.0)

    @export
    def set_config(self, config):
        """Sets the config dictionary"""
        for key in list(config.keys()):
            self.config[key] = config[key]
        self.config.save()
        if self.looping_call.running:
            self.looping_call.stop()
        self.looping_call.start(self.config['interval'] * 3600.0)

    @export
    def get_config(self):
        """Returns the config dictionary"""
        return self.config.config

    @export
    def get_remove_rules(self):
        return {
            'func_ratio': 'Ratio',
            'func_added': 'Age in days',
            'func_seed_time': 'Seed Time (h)',
            'func_seeders': 'Seeders',
            'func_availability': 'Availability',
            'func_time_since_transfer': 'Time since transfer (h)',
            'func_time_seen_complete': 'Time since seen complete (h)'
        }

    @export
    def get_ignore(self, torrent_ids):
        if not hasattr(torrent_ids, '__iter__'):
            torrent_ids = [torrent_ids]

        return [self.torrent_states.config.get(t, False) for t in torrent_ids]

    @export
    def set_ignore(self, torrent_ids, ignore=True):
        log.debug(
            "AutoRemovePlus: Setting torrents %s to ignore=%s"
            % (torrent_ids, ignore)
        )

        if not hasattr(torrent_ids, '__iter__'):
            torrent_ids = [torrent_ids]

        for t in torrent_ids:
            self.torrent_states[t] = ignore

        self.torrent_states.save()

    def blacklistTorrent(self, i, t, label_str, name):
        hash = t.get_status(['hash'])['hash'].upper()    
                
        if label_str and label_str in self.accepted_labels:
            mediaObject = self.sonarr if label_str == 'tv-sonarr' else self.radarr if label_str == 'radarr' else self.lidarr
        elif not label_str:
            log.warning("No label for {}".format(name))
            return
        else:
            log.warning("Unknown label for torrrent {}".format(name))
            return
        
        if mediaObject:
            mediaList = mediaObject.get_queue()
            log.debug("Size of media list: {}".format(len(mediaList)))
            if hash in mediaList:
                id = str(mediaList[hash].get('id'))
                log.info("hash: {}, id: {},type = {}".format(hash,id,type(id)))
                
                #blacklist from PVR
                response = mediaObject.delete_queueitem(id)
                changed = True
                log.info("Blacklist request for torrent {} returned {}".format(name,response))
                
                isFinished = t.get_status(['is_finished'])['is_finished']
                remove_data = self.config['seed_remove_data'] if isFinished else self.config['remove_data']
                
                #remove from deluge
                result = self.remove_torrent(i,remove_data)
                log.info("Removing {} torrent {} {} data returned: {}".format('unfinished' if not isFinished else 'finished', name, 'with' if remove_data else 'without', result))
                    
                return result
            else:
                log.warning("Could not blacklist torrent {}: not in server queue: {}".format(name, hash))
                log.debug("List: {}".format(mediaList))
                
                isFinished = t.get_status(['is_finished'])['is_finished']
                remove_data = self.config['seed_remove_data'] if isFinished else self.config['remove_data']
                
                #remove from deluge
                result = self.remove_torrent(i,remove_data)
                log.info("Removing {} torrent {} {} data. Result: {}".format('unfinished' if not isFinished else 'finished', name, 'with' if remove_data else 'without', result))
                
                return result
        else:
            log.warning("Upstream server not found for label: {}".format(label_str))
            return
            
    @export
    def blacklistCommand(self, torrent_ids):
        log.info("blacklistCommand torrent running for {}".format(torrent_ids))
        
        use_sonarr = self.config['enable_sonarr'] if self.config['enable_sonarr'] else False
        use_radarr = self.config['enable_radarr'] if self.config['enable_radarr'] else False
        use_lidarr = self.config['enable_lidarr'] if self.config['enable_lidarr'] else False
          
        sonarr_list = self.sonarr.get_queue() if use_sonarr else {}
        radarr_list = self.radarr.get_queue() if use_radarr else {}
        lidarr_list = self.lidarr.get_queue() if use_lidarr else {}
        try:
            total_size = len(sonarr_list) + len(lidarr_list) + len(radarr_list)
            log.info("Size of lists: sonarr:{}, lidarr:{}, radarr:{}".format(len(sonarr_list),len(lidarr_list),len(radarr_list)))
        except Exception as e:
            log.error("Error summing lists: {}".format(e))
            return
            
        if not total_size or total_size == 0: 
            log.warning("No torrents found in queue")
            return
            
        label_str = None
        blackListedNum = 0
                
        if not hasattr(torrent_ids, '__iter__'):
            torrent_ids = [torrent_ids]

        for i in torrent_ids:
            t = self.torrentmanager.torrents.get(i, None)
            log.debug("i = {}, t = {}, types = {}/{}".format(i,t,type(i),type(t)))
            if not t:
                log.warning("No torrent object for: {}".format(i))
                continue
            else: 
                name = t.get_status(['name'])['name']
                
                if not name:
                    log.warning("Skipping blacklisting of torrent {}: could not get name".format(i))
                    continue
                else:
                    #try:
                    label_str = component.get("CorePlugin.Label")._status_get_label(i)
                    if label_str and label_str in self.accepted_labels:
                        if (label_str == 'tv-sonarr' and use_sonarr) or (label_str == 'radarr' and use_radarr) or (label_str == 'lidarr' and use_lidarr):
                            result = self.blacklistTorrent(i,t,label_str,name)
                            if result:
                                blackListedNum += 1
                            log.info("Blacklist request returned: {}".format(result))
                        else:
                            log.info("Blacklisting not enabled for  {}".format(label_str))
                    #except Exception as e:
                    #   log.warning("Error getting label for torrent {}: {}".format(name,e))
                    #   continue
                           
        self.torrent_states.save()
        return blackListedNum
        
    def check_min_space(self):
        min_hdd_space = self.config['hdd_space']
        real_hdd_space = component.get("Core").get_free_space() / 1073741824.0

        log.debug("Space: %s/%s" % (real_hdd_space, min_hdd_space))

        # if deactivated delete torrents
        if min_hdd_space < 0.0:
            return False

        # if hdd space below minimum delete torrents
        if real_hdd_space > min_hdd_space:
            return True  # there is enough space
        else:
            return False

    def pause_torrent(self, torrent):
        try:
            torrent.pause()
        except Exception as e:
            log.warning("AutoRemovePlus: Problems pausing torrent: {}".format(e))

    def remove_torrent(self, tid, remove_data):
        log.debug("Running remove_torrent: {} with remove data = {}".format(tid,remove_data))
        try:
            self.torrentmanager.remove(tid, remove_data=remove_data)
        except Exception as e:
            log.warning("AutoRemovePlus: Error removing torrent {}: {}".format(tid,e))
        try:
            del self.torrent_states.config[tid]
        except KeyError:
            log.warning("AutoRemovePlus: no saved state for torrent {}".format(tid))
            return True
        except Exception as e:
            log.warning("AutoRemovePlus: Error deleting state for torrent {}: {}".format(tid, e))
            return False
        else:
            return True

    def get_torrent_rules(self, id, torrent, tracker_rules, label_rules):
        
        total_rules = []

        try:
          for t in torrent.trackers:
              for name, rules in list(tracker_rules.items()):
                  log.debug("Get_torrent_rules: processing name = {}, rules = {}, url = {}, find = {} ".format(name, rules,t['url'],t['url'].find(name.lower())))
                  if(t['url'].find(name.lower()) != -1):
                      for rule in rules:
                          total_rules.append(rule)
        except Exception as e:
          log.warning("Get_torrent_rules: Exception with getting torrent rules for {}: {}".format(id,e))
          return total_rules
          
        if label_rules:
            try:
                # get label string
                label_str = component.get(
                    "CorePlugin.Label"
                )._status_get_label(id)

                # if torrent has labels check them
                labels = [label_str] if len(label_str) > 0 else []

                for label in labels:
                    if label in label_rules:
                        for rule in label_rules[label]:
                            total_rules.append(rule)
            except Exception as e:
                log.warning("Cannot obtain torrent label for {}: {}".format(id,e))
        log.debug("Get_torrent_rules: returning rules for {}: {}".format(id,total_rules))
        return total_rules

    # we don't use args or kwargs it just allows callbacks to happen cleanly
    def periodicScan(self, *args, **kwargs):
        log.info("AutoRemovePlus: Running check. Interval is {} minutes".format(round(self.config['interval'] * 60.0,1)))
        
        try:
          max_seeds = int(self.config['max_seeds'])
          count_exempt = self.config['count_exempt']
          remove_data = self.config['remove_data']
          seed_remove_data = self.config['seed_remove_data']
          exemp_trackers = self.config['trackers']
          exemp_labels = self.config['labels']
          min_val = float(self.config['min'])
          max_val2 = float(self.config['min2'])
          remove = self.config['remove']
          enabled = self.config['enabled']
          tracker_rules = self.config['tracker_rules']
          rule_1_chk = self.config['rule_1_enabled']
          rule_2_chk = self.config['rule_2_enabled']
          seedtime_limit = float(self.config['seedtime_limit'])
          seedtime_pause = float(self.config['seedtime_pause'])
          always_pause_seed = self.config['pause_seed']
          labels_enabled = False
          use_sonarr = self.config['enable_sonarr'] if self.config['enable_sonarr'] else False
          use_radarr = self.config['enable_radarr'] if self.config['enable_radarr'] else False
          use_lidarr = self.config['enable_lidarr'] if self.config['enable_lidarr'] else False
          
          sonarr_list = self.sonarr.get_queue() if use_sonarr else {}
          radarr_list = self.radarr.get_queue() if use_radarr else {}
          lidarr_list = self.lidarr.get_queue() if use_lidarr else {}
          
          #prevent hit & run
          seedtime_pause = seedtime_pause if seedtime_pause > 20.0 else 20.0
          seedtime_limit = seedtime_limit if seedtime_limit > 24.0 else 24.0
          
          log.debug("Using sonarr: {}, radarr: {}, lidarr: {}".format(use_sonarr,use_radarr,use_lidarr))
          log.info("Size of lists: sonarr:{}, lidarr:{}, radarr:{}".format(len(sonarr_list),len(lidarr_list),len(radarr_list)))
                   
          #response = self.sonarr.delete_queueitem('1771649588')          
          #log.info("Delete response:{}".format(response))
          
        except Exception as e:
          log.error("Error reading config: {}".format(e))
          return False
        
        if 'Label' in component.get(
            "CorePluginManager"
        ).get_enabled_plugins():
            labels_enabled = True
            label_rules = self.config['label_rules']
        else:
            log.warning("WARNING! Label plugin not active")
            log.debug("No labels will be checked for exemptions!")
            label_rules = []

        # Negative max means unlimited seeds are allowed, so don't do anything
        if max_seeds < 0:
            return

        torrent_ids = self.torrentmanager.get_torrent_list()

        log.info("Number of torrents: {0}".format(len(torrent_ids)))

        # If there are less torrents present than we allow
        # then there can be nothing to do
        if len(torrent_ids) <= max_seeds:
            return

        torrents = []
        ignored_torrents = []

        # relevant torrents to us exist and are finished
        for i in torrent_ids:
            t = self.torrentmanager.torrents.get(i, None)
      
            try:
                ignored = self.torrent_states[i]
            except KeyError as e:
                ignored = False

            ex_torrent = False
            trackers = t.trackers

            # check if trackers in exempted tracker list
            for tracker, ex_tracker in (
                (t, ex_t) for t in trackers for ex_t in exemp_trackers
            ):
                if(tracker['url'].find(ex_tracker.lower()) != -1):
                    log.debug("Found exempted tracker: %s" % (ex_tracker))
                    ex_torrent = True

            # check if labels in exempted label list if Label plugin is enabled
            if labels_enabled:
                try:
                    # get label string
                    label_str = component.get(
                        "CorePlugin.Label"
                    )._status_get_label(i)

                    # if torrent has labels check them
                    labels = [label_str] if len(label_str) > 0 else []

                    for label, ex_label in (
                        (l, ex_l) for l in labels for ex_l in exemp_labels
                    ):
                        if(label.find(ex_label.lower()) != -1):
                            log.debug("Found exempted label: %s" % (ex_label))
                            ex_torrent = True
                except Exception as e:
                    log.warning("Cannot obtain torrent label: {}".format(e))

            # if torrent tracker or label in exemption list, or torrent ignored
            # insert in the ignored torrents list
            (ignored_torrents if ignored or ex_torrent else torrents)\
                .append((i, t))

        log.info("Number of ignored torrents: {0}".format(len(ignored_torrents)))

        # now that we have trimmed active torrents
        # check again to make sure we still need to proceed
        if len(torrents) +\
                (len(ignored_torrents) if count_exempt else 0) <= max_seeds:
            return

        # if we are counting ignored torrents towards our maximum
        # then these have to come off the top of our allowance
        if count_exempt:
            max_seeds -= len(ignored_torrents)
            if max_seeds < 0:
                max_seeds = 0
 
        # Alternate sort by primary and secondary criteria
        torrents.sort(
            key=lambda x: (
                filter_funcs.get(
                    self.config['filter'],
                    _get_ratio
                )(x),
                filter_funcs.get(
                    self.config['filter2'],
                    _get_ratio
                )(x)
            ),
            reverse=False
        )

        changed = False

        # remove or pause these torrents
        for i, t in reversed(torrents[max_seeds:]):
            name = t.get_status(['name'])['name']
            log.debug("Now processing name = {}, type = {}".format(name,type(name)))
            # check if free disk space below minimum
            if self.check_min_space():
                break  # break the loop, we have enough space
                
            if enabled:
                # Get result of first condition test
                filter_1 = filter_funcs.get(self.config['filter'], _get_ratio)((i, t)) <= min_val
                # Get result of second condition test
                
                #chosen_func = self.config['filter2']
                # prevent hit and runs
                max_val2 = max_val2 if max_val2 > 0.5 else 0.5
                #log.info("Chosen filter2 : {}, cut-off: {}".format(chosen_func,max_val2))
                
                filter_2 = filter_funcs.get(self.config['filter2'], _get_ratio)((i, t)) >= max_val2

                specific_rules = self.get_torrent_rules(i, t, tracker_rules, label_rules)

                # Sort rules according to logical operators, AND is evaluated first
                specific_rules.sort(key=lambda rule: rule[0])

                remove_cond = False
                seed_remove_cond  = False #for removing finished torrents

                # If there are specific rules, ignore general remove rules
                if specific_rules:
                    remove_cond = filter_funcs.get(specific_rules[0][1])((i,t)) \
                        >= specific_rules[0][2]
                    for rule in specific_rules[1:]:
                        check_filter = filter_funcs.get(rule[1])((i,t)) \
                            >= rule[2]
                        remove_cond = sel_funcs.get(rule[0])((
                            check_filter,
                            remove_cond
                        ))
                    seed_remove_cond = remove_cond
                elif rule_1_chk and rule_2_chk:
                    # If both rules active use custom logical function
                    remove_cond = sel_funcs.get(self.config['sel_func'])((
                        filter_1,
                        filter_2
                    ))
                elif rule_1_chk and not rule_2_chk:
                    # Evaluate only first rule, since the other is not active
                    remove_cond = filter_1
                elif not rule_1_chk and rule_2_chk:
                    # Evaluate only second rule, since the other is not active
                    remove_cond = filter_2

                # If logical functions are satisfied remove or pause torrent
                # add check that torrent is not completed
                try:
                    name = t.get_status(['name'])['name']
                    age = _age_in_days((i,t)) # age in days
                    seedtime = round(t.get_status(['seeding_time'])['seeding_time']/3600,2) #seed time in hours
                    ratio = t.get_status(['ratio'])['ratio']
                    availability = t.get_status(['distributed_copies'])['distributed_copies']
                    time_last_transfer = _time_last_transfer((i,t)) # in hours
                    time_seen_complete = _time_seen_complete((i,t)) #seen complete in hours
                    isFinished = t.get_status(['is_finished'])['is_finished']
                    paused = t.get_status(['paused'])['paused']
                    hash = t.get_status(['hash'])['hash'].upper()                    
                except Exception as e:
                    log.error("Error with torrent: {}".format(e))
                    continue
                if time_seen_complete:
                    log.debug("Processing torrent: {}, last transfer: {} h, last seen complete: {} h, paused: {}".format(name,time_last_transfer,time_seen_complete,paused))
                
                if not isFinished:
                    try:
                        label_str = component.get("CorePlugin.Label")._status_get_label(i)
                        if not label_str:
                            log.warning("Torrent: {}, label = {}".format(name,label_str))
                    except Exception as e:
                        log.error("Error getting label for torrent {}: {}".format(name,e))
                        label_str = 'none'
                    log.debug("Processing unfinished torrent {}, label = {}".format(name,label_str))
                    if remove_cond:
                        #user has selected to remove torrents
                        if remove:
                            # blacklist
                            if label_str and label_str in self.accepted_labels:
                                if (label_str == 'tv-sonarr' and use_sonarr) or (label_str == 'radarr' and use_radarr) or (label_str == 'lidarr' and use_lidarr):
                                    result = self.blacklistTorrent(i,t,label_str,name)
                                    log.info("Blacklist request for {} returned: {}".format(name,result))
                            else:
                                log.warning("No matching label {} for torrent {}".format(label_str,name))
                                
                            # remove using local method
                            result = self.remove_torrent(i, remove_data)
                            log.info("AutoRemovePlus: removing unfinished torrent {} with data using internal method: {}".format(name,result))                            
                        else:
                            #pause instead
                            if not paused:
                                log.info("AutoRemovePlus: Pausing torrent {} due to availability = {}, age = {}, time_last_transfer = {}".format(name, availability, age,time_last_transfer))
                                self.pause_torrent(t)                        

                else: # is finished
                    
                  log.debug("Fin.: {}, seed time:{}/{}, ratio: {}, spec. rules = {}, sr cond. = {}/{},isfinished = {}, hash = {}".format(name,seedtime,seedtime_limit,ratio,specific_rules,remove_cond,seed_remove_cond,isFinished,hash))                  
                  if (not specific_rules) or (seed_remove_cond):                                       
                    #remove condition
                    if seedtime > seedtime_limit:
                        if not always_pause_seed:
                            #seed_remove_data decides if user wants data removed or not
                            self.remove_torrent(i, seed_remove_data)
                            changed = True
                            log.info("AutoRemovePlus: removing torrent from seed: {} due to seed time = {}/{} h".format(name,seedtime,seedtime_limit))
                        
                    #pause condition
                    elif seedtime > seedtime_pause: 
                      try:
                        #paused = t.get_status(['paused'])['paused']
                        if not paused:
                          self.pause_torrent(t)
                          #changed = True
                          log.info("AutoRemovePlus: pausing finished torrent {} with seedtime = {}/{} h, ratio = {}, rules = {}, sr-cond = {}/{}".format(name,seedtime,seedtime_pause,ratio,specific_rules,remove_cond,seed_remove_cond))
                        else:
                          log.debug("AutoRemovePlus: torrent is already paused: {}".format(name))
                      except Exception as e:
                          log.warning("AutoRemovePlus: error with pausing torrent: {}".format(name))

        # If a torrent exemption state has been removed save changes
        if changed:
            self.torrent_states.save()
