[![License: MPL 2.0](https://img.shields.io/badge/License-MPL%202.0-brightgreen.svg)](https://opensource.org/licenses/MPL-2.0) [![Build Status](https://secure.travis-ci.org/joyent/webconsole-cloudapi-client.svg)](http://travis-ci.org/joyent/webconsole-cloudapi-client)

CloudApi fetch client

## API

### Constructor

- `token` - included as `'X-Auth-Token'` HTTP header on all requests for this client. Require for production.
- `key` - private key used to sign request, must be a string or an object with [`{ key, passphrase }`](https://nodejs.org/api/crypto.html#crypto_sign_sign_privatekey_outputformat)
- `keyId` - CloudAPI formatted key ID, usually in the form 'user/keys/md5 id'
- `url` - base URL for CloudAPI service
- `pathPrefix` - default path prefix for all requests, defaults to `'/my'`.
- `log` - function used to log errors for debugging purposes
- `tracer` - optional object used for OpenTracing tracing. Must have function for `startSpan`

### `fetch(path[, options ])`

- `path` - is a string of the resource to request
- `options` - object with the following properties
  - `includeRes` - boolean, indicates if the raw `res` object should be returned. Defaults to only returning the `payload`
  - `span` - parent OpenTracing span that initiated this request
  - `method` - HTTP method, defaults to 'GET'
  - `query` - object with any query string name/values to include
  - `payload` - object to JSON stringify and send to the server
  - `headers` - any additional HTTP headers to include
