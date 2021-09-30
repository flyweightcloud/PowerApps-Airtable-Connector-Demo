import * as https from 'https'
import { IncomingMessage, RequestOptions } from 'http'

interface RequestResult {
    response:  IncomingMessage
    body: string
}

// We could use a libray for this, but even the smallest ones are > 100k
// Ideal serverless functions are small in size so they can load quickly from idle

function httpsRequest(options: RequestOptions, data?: any): Promise<RequestResult> {
    return new Promise((resolve, reject) => {
        if (data && !options.headers['Content-Length']) {
            options.headers['Content-Length'] = data.length
        }

        const req = https.request(options, function (res) {
            let body = '';
            res.on('data', function (chunk) {
                body += chunk;
            });
            res.on('end', function () {
                resolve({response: res, body})
            });
            res.on('error', function (err) {
                reject(err)
            })
        });

        req.on('error', function (err) {
            reject(err)
        });

        if (data) {
            req.write(data)
        }

        req.end();
    });
}

export {
    httpsRequest,
}