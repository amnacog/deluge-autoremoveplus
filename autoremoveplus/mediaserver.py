#!/usr/bin/env python
from __future__ import absolute_import
from __future__ import division
from __future__ import print_function
from __future__ import unicode_literals

"""mediaserver.py: API for making API calls to sonarr/lidarr/radarr servers."""

__author__      = "Jools"
__email__       = "springjools@gmail.com"
__copyright__   = "Copyright 2019"

# Copyright 2019 Jools Holland

# Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

# The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

from builtins import str
from builtins import object
import argparse
import requests
import json
import io
import os
import logging
import configparser
log = logging.getLogger(__name__)

from deluge.plugins.pluginbase import CorePluginBase
import deluge.component as component
import deluge.configmanager
from deluge.core.rpcserver import export


httpErrors = {
    200 : 'OK',
    201 : 'Created',
    202 : 'Accepted',
    203 : 'Non-authoritative Information',
    204 : 'No Content',
    205 : 'Reset Content',
    206 : 'Partial Content',
    207 : 'Multi-Status',
    208 : 'Already Reported',
    226 : 'IM Used',
    300 : 'Multiple Choices',
    301 : 'Moved Permanently',
    302 : 'Found',
    303 : 'See Other',
    304 : 'Not Modified',
    305 : 'Use Proxy',
    307 : 'Temporary Redirect',
    308 : 'Permanent Redirect',
    400 : 'Bad Request',
    401 : 'Unauthorized',
    402 : 'Payment Required',
    403 : 'Forbidden',
    404 : 'Not Found',
    405 : 'Method Not Allowed',
    406 : 'Not Acceptable',
    407 : 'Proxy Authentication Required',
    408 : 'Request Timeout',
    409 : 'Conflict',
    410 : 'Gone',
    411 : 'Length Required',
    412 : 'Precondition Failed',
    413 : 'Payload Too Large',
    414 : 'Request-URI Too Long',
    415 : 'Unsupported Media Type',
    416 : 'Requested Range Not Satisfiable',
    417 : 'Expectation Failed',
    418 : 'I\'m a teapot',
    421 : 'Misdirected Request',
    422 : 'Unprocessable Entity',
    423 : 'Locked',
    424 : 'Failed Dependency',
    426 : 'Upgrade Required',
    428 : 'Precondition Required',
    429 : 'Too Many Requests',
    431 : 'Request Header Fields Too Large',
    444 : 'No Response (Nginx)',
    451 : 'Unavailable For Legal Reasons',
    499 : 'Client Closed Request',
    500 : 'Internal Server Error',
    501 : 'Not Implemented',
    502 : 'Bad Gateway',
    503 : 'Service Unavailable',
    504 : 'Gateway Timeout',
    505 : 'HTTP Version Not Supported',
    506 : 'Variant Also Negotiates',
    507 : 'Insufficient Storage',
    508 : 'Loop Detected',
    510 : 'Not Extended',
    511 : 'Network Authentication Required',
    522 : 'Connection timed out, server denied request for OAuth token',
    599 : 'Network Connect Timeout Error',
    #@TODO Add full list
}

class HTTP_MethodError(Exception):
    def __init__(self, value):
        self.value = value
    def __str__(self):
        return repr(self.value)

class Mediaserver(object):
    def __init__(self, server, apikey, type='sonarr'):
        self.server     = server
        self.api_key    = apikey
        self.type       = type
        self.endpoint       = '/sonarr/api/v3' if type == 'sonarr' else '/lidarr/api/v1' if type == 'lidarr' else '/radarr/api' if type == 'radarr' else None
              
        if self.endpoint is None:
            raise Exception('Unknown server: {}'.format(type))
        
        log.info ("Endpoint of {} is {}".format(self.type,self.endpoint))

    def get_queue(self):
        """ Get queue from server
        """

        # Create and send HTTP Get to the mediaserver
        h={
            'http.useragent' : 'Deluge-autoremoveplus',
            'x-api-key'      :  self.api_key,
            'Content-Type'   : 'application/json',
            'User-Agent'     : 'Deluge/Autoremoveplus',
            'Accept-Encoding': 'gzip'
        }
        
        pagenum = 1
        output = {}
        
        while True:
            try:
                url = self.server + self.endpoint + '/queue?' +str('page=') + str(pagenum)
                log.debug("Sending GET request to {}".format(url))
                r = requests.get(url, headers=h,timeout=30)
            except Exception as e:
                raise HTTP_MethodError('Error Connecting to server: {}'.format(e))
            
            log.debug("HTTP {}: {}".format(r.status_code,httpErrors[r.status_code]))
            
            if r.status_code == 200: #200 = 'OK'
                total_records = r.json()['totalRecords'] if  (self.type == 'lidarr' or self.type == 'sonarr') else -1 # return negative number if no total is available
                records_left = total_records-pagenum*10
                log.debug("Page {}, total records {}, left {}".format(pagenum,total_records,records_left))
                parsedata = (r.json()['records'] if (self.type == 'lidarr' or self.type == 'sonarr') else r.json())
                try:
                    for data in parsedata:
                        output[data.get('downloadId')] = {'id':data.get('id'),'title':data.get('title')}       
                except Exception as e:
                    log.error("Invalid mediaserver type: {}, {}".format(self.type,e))
                if records_left <= 0: break;
                pagenum += 1
                
                if pagenum > 500:
                    log.warn("Capped at 500 iterations for server {}. Total records reported as {}".format(self.type,total_records))
                    break;
                
            else:
                raise Exception("Cannot get queue:  {} ({})".format(r.status_code,httpErrors[r.status_code]))
                
        log.debug("Returning {} records from {} queue".format(len(output),self.type))
        return output
               
    def get_blacklist(self):
        """ Get blacklist from server
            
        """
        
        # Create and send HTTP Get to the mediaserver
        h={
            'http.useragent' : 'Deluge-autoremoveplus',
            'x-api-key'      :  self.api_key,
            'Content-Type'   : 'application/json',
            'User-Agent'     : 'Deluge/Autoremoveplus',
            'Accept-Encoding': 'gzip'
        }

        url = self.server + self.endpoint + '/blacklist?sortkey=date'

        log.debug("Sending GET request to {}: type = {}".format(url,type(url)))
        
        try:
            r = requests.get(url, headers=h,timeout=30)
        except Exception as e:
            raise HTTP_MethodError('Error Connecting to server: {}'.format(e))
        
        log.debug ("HTTP {}: {}".format(r.status_code,httpErrors[r.status_code]))
        
        if r.status_code == 200: #200 = 'OK'
            output = r.json().get('records') if r.json().get('records') else r.json()
            return output
        else:
            log.error("Error getting blacklist for {}: {}".format(self.type,r.status_code))
            return False
        
    def delete_blacklist_item(self, item_id):
        """ Get queue from server
            
        """
        
        # Create and send HTTP Delete to the mediaserver
        h={ #For some reason header update doesnt work
            'http.useragent' : 'Deluge-autoremoveplus',
            'x-api-key'      :  self.api_key,
            'Content-Type'   : 'application/json',
            'User-Agent'     : 'Deluge/Autoremoveplus',
            'Accept-Encoding': 'gzip'
        }
        query = str(item_id)
        url = self.server + self.endpoint + '/blacklist/'+ query
        log.debug("Sending DELETE request to {}: type = {}".format(url,type(url)))
        
        try:
            r = requests.delete(url, headers=h,timeout=30)
        except Exception as e:
            raise HTTP_MethodError('Error Connecting to server: {}'.format(e))
        
        log.debug ("HTTP {}: {}".format(r.status_code,httpErrors[r.status_code]))
        if r.status_code == 200: #200 = 'OK'
            return r.json()
        else:
            #return r.status_code,r.json()
            log.error ("HTTP {}: {}".format(r.status_code,httpErrors[r.status_code]))
            raise Exception("Error deleting blacklist item for {}: {}".format(self.type,r.status_code))

    def delete_queueitem(self,item_id,blacklist = 'true',removeFromClient = 'false'):
        """ delete queue item from server
        """
        
        # Create and send HTTP Delete request to the mediaserver
        h={
            'http.useragent' : 'Deluge-autoremoveplus',
            'x-api-key'      :  self.api_key,
            'Content-Type'   : 'application/json',
            'User-Agent'     : 'Deluge/Autoremoveplus',
            'Accept-Encoding': 'gzip'
        }
        log.debug("Parsing item id: {}, type = {}".format(item_id,type(item_id)))
        try:
            query = str(item_id)+'?blacklist='+str(blacklist)+'&removeFromClient='+str(removeFromClient)
            url = self.server + self.endpoint + '/queue/' + query
            log.debug("Got this: url = {}, type = {}, query = {}, type =? {}".format(url, type(url),query,type(query)))
        except Exception as e:
            log.error("Unable to create delete query for item {}: {}".format(item_id,e))
            return False
        log.debug("Sending DELETE request to {}: type = {}".format(url,type(url)))
        
        try:
            r = requests.delete(url, headers=h,timeout=30)
        except Exception as e:
            raise HTTP_MethodError('Error Connecting to server: {}'.format(e))
        
        log.debug ("HTTP {}: {}".format(r.status_code,httpErrors[r.status_code]))
        
        if r.status_code == 200: #200 = 'OK'
            try:
                output = r.json()
            except Exception as e:
                log.error ("Error decoding response: {}".format(e))
                return False            
            return output
        else:
            log.error("HTTP {}: {}".format(r.status_code,httpErrors[r.status_code]))
            log.error("Unable to delete item {}, query = {}, url = {}, response = {}".format(item_id,query,url,r.status_code))
            return False



def main(server,mode='queue',item=None):
    log.info("Server = {}, mode = {}, item = {}".format(server,mode,item))
    if mode == 'queue':
        q = server.get_queue()
        print("{} queue: {}".format(server.type,q))
    elif mode == 'delete':
        if item is None:
            log.error("Invalid item {}".format(item))
            return
        resp = server.delete_queueitem(item)
        log.info("Delete request for {} returned {}".format(item,resp))

if __name__ == '__main__':
    logging.getLogger().setLevel(logging.INFO)
    logging.basicConfig()
    log = logging.getLogger('mediaserver')
    parser = argparse.ArgumentParser(description = 'Say hello')
    parser.add_argument('server', help='which media server')
    parser.add_argument('mode', help='operation mode', default='queue')
    parser.add_argument('--item', help='id of item to operate on',default=None)
    args = parser.parse_args()
    
    # Load the configuration file
    file = os.path.join(os.path.dirname(__file__),'data/server.ini')
    config = configparser.ConfigParser()
    config.read(file)

    try:
        apikey_sonarr = config['general']['apikey_sonarr']
        apikey_lidarr = config['general']['apikey_lidarr']
        apikey_radarr = config['general']['apikey_radarr']
        server        = config['general']['server']
    except Exception as e:
        log.error("Cannot read server config: make sure it exists in './data/server.ini:' {}".format(e))
        exit ();
        
    server = Mediaserver(server,apikey_sonarr,'sonarr') if args.server == 'sonarr' else Mediaserver(server,apikey_radarr,'radarr') if args.server == 'radarr' else Mediaserver(server,apikey_lidarr,'lidarr')
    main(server,args.mode,args.item)


        