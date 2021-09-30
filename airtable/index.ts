import * as fs from 'fs/promises'
import * as path from 'path'
import { AzureFunction, Context, HttpRequest } from "@azure/functions"

import config from '../config'
import { httpsRequest } from '../lib/request'
import { defaultCorsHeaders } from '../lib/cors'

interface Customer {
    _id: string
    _createdTime: string
    Name: string
    Status: string
    CreatedBy: string
}

interface JWT {
    header: any
    body: any
}

function parseJWT(jwtStr: string): JWT  {
    const jwtParts = jwtStr.split('.').slice(0,2).map((p) => JSON.parse(Buffer.from(p, 'base64').toString()));
    return {
        header: jwtParts[0],
        body: jwtParts[1]
    }
}

function airTableMap(record) {
    const result = record.fields
    result._id = record.id
    result._createdTime = record.createdTime
    return result
}

async function createCustomer(context: Context, req: HttpRequest): Promise<void> {
    const jwt = parseJWT(req.headers['authorization'].split(' ')[1])
    const data = {
        records: [
            {
                fields: {
                    Name: req.body.name,
                    Status: req.body.status,
                    CreatedBy: jwt.body.upn
                }

            }
        ]
    }
    const resp = await httpsRequest({
        hostname: 'api.airtable.com',
        port: 443,
        path: '/v0/app7Ns7bmcPNrCI3a/Inbound',
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.airtableApiKey}`,
            'Content-Type': 'application/json',
        }
    }, JSON.stringify(data))
    const jsonResp = JSON.parse(resp.body)
    return jsonResp.records.map(airTableMap)
}

async function getCustomers(context: Context, req: HttpRequest): Promise<Customer[]> {
    const resp = await httpsRequest({
        hostname: 'api.airtable.com',
        port: 443,
        path: '/v0/app7Ns7bmcPNrCI3a/Inbound?view=Grid%20view',
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${config.airtableApiKey}`,
        }
    })
    const jsonResp = JSON.parse(resp.body)
    return jsonResp.records.map(airTableMap)
}

async function swaggerFile(fnDir: string): Promise<string> {
    const content = await fs.readFile(path.join(__dirname, '..', '..', fnDir, 'swagger.json'))
    const json = JSON.parse(content.toString());
    json['host'] = config.azureHost;
    return JSON.stringify(json)
}

const httpTrigger: AzureFunction = async function (context: Context, req: HttpRequest): Promise<void> {
    context.log('HTTP trigger function processed a request.');
    context.log(`${req.method} - ${req.url}`)
    context.log(req.headers)
    const paths = new URL(req.url).pathname.split('/')
    const fnDir = paths[2]
    const action = paths[paths.length - 1]
    // if (action === 'swagger' || !req.headers['authorization']) {
    if (action === 'swagger') {
        context.res = {
            body: await swaggerFile(fnDir),
            headers: {...defaultCorsHeaders, 'Content-Type':'application/json'}
        }
        return 
    }
    let customers;
    if (req.method.toLowerCase() === 'post') {
        customers = await createCustomer(context, req)
    } else {
        customers = await getCustomers(context, req);
    }
    context.res = {
        // status: 200, /* Defaults to 200 */
        body: customers,
        headers: {...defaultCorsHeaders, 'Content-Type':'application/json'}
    };
};

export default httpTrigger;