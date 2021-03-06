// @ts-ignore`
import {AxiosInstance} from "axios";
import {BucketSettings} from "./BucketSettings";
import {BucketInfo} from "./BucketInfo";
import {EntryInfo} from "./EntryInfo";
import * as Stream from "stream";
import {Record} from "./Record";

/**
 * Represents a bucket in Reduct Storage
 */
export class Bucket {
    readonly name: string;
    private httpClient: AxiosInstance;

    /**
     * Create a bucket. Use Client.creatBucket or Client.getBucket instead it
     * @constructor
     * @param name
     * @param httpClient
     * @see {Client}
     */
    constructor(name: string, httpClient: AxiosInstance) {
        this.name = name;
        this.httpClient = httpClient;
    }

    /**
     * Get bucket settings
     * @async
     * @return {Promise<BucketSettings>}
     */
    async getSettings(): Promise<BucketSettings> {
        const {data} = await this.httpClient.get(`/b/${this.name}`);
        return Promise.resolve(BucketSettings.parse(data.settings));
    }

    /**
     * Set bucket settings
     * @async
     * @param settings {BucketSettings} new settings (you can set a part of settings)
     */
    async setSettings(settings: BucketSettings): Promise<void> {
        await this.httpClient.put(`/b/${this.name}`, BucketSettings.serialize(settings));
    }

    /**
     * Get information about a bucket
     * @async
     * @return {Promise<BucketInfo>}
     */
    async getInfo(): Promise<BucketInfo> {
        const {data} = await this.httpClient.get(`/b/${this.name}`);
        return BucketInfo.parse(data.info);
    }

    /**
     * Get entry list
     * @async
     * @return {Promise<EntryInfo>}
     */
    async getEntryList(): Promise<EntryInfo[]> {
        const {data} = await this.httpClient.get(`/b/${this.name}`);
        return Promise.resolve(data.entries.map((entry: any) => EntryInfo.parse(entry)));
    }

    /**
     * Remove bucket
     * @async
     * @return {Promise<void>}
     */
    async remove(): Promise<void> {
        await this.httpClient.delete(`/b/${this.name}`);
    }

    /**
     * Write a record into an entry
     * @param entry name of the entry
     * @param data {string | Buffer} data as string
     * @param ts {BigInt} timestamp in microseconds for the record. It is current time if undefined.
     */
    async write(entry: string, data: string | Buffer, ts?: bigint): Promise<void> {
        const stream = Stream.Readable.from(data);
        await this.writeStream(entry, stream, data.length, ts);
    }

    /**
     * Write a record from a stream
     * @param entry name of the entry
     * @param stream stream to write
     * @param content_length content length in size. The storage engine should know it in advance
     * @param ts {BigInt} timestamp in microseconds for the record. It is current time if undefined.
     */
    async writeStream(entry: string, stream: Stream, content_length: bigint | number, ts?: bigint): Promise<void> {
        ts ||= BigInt(Date.now() * 1000);
        await this.httpClient.post(`/b/${this.name}/${entry}?ts=${ts}`, stream,
            {headers: {"content-length": content_length.toString()}});
    }

    /**
     * Read a record from an entry
     * @param entry name of the entry
     * @param ts {BigInt} timestamp of record in microseconds. Get the latest one, if undefined
     */
    async read(entry: string, ts?: bigint): Promise<Buffer> {
        const stream = await this.readStream(entry, ts);
        const chunks: Buffer[] = [];
        return new Promise((resolve, reject) => {
            stream.on("data", (chunk: Buffer) => chunks.push(chunk));
            stream.on("error", (err: Error) => reject(err));
            stream.on("end", () => resolve(Buffer.concat(chunks)));
        });
    }

    /**
     * Read a record from an entry as a stream
     * @param entry name of the entry
     * @param ts {BigInt} timestamp of record in microseconds. Get the latest one, if undefined
     */
    async readStream(entry: string, ts?: bigint): Promise<Stream> {
        let url = `/b/${this.name}/${entry}`;
        if (ts !== undefined) {
            url += `?ts=${ts}`;
        }
        const {data} = await this.httpClient.get(url, {responseType: "stream"});
        return data;
    }

    /**
     * List records for a time period
     * @param entry {string} name of the entry
     * @param start {BigInt} start point of the time period
     * @param stop {BigInt} stop point of the time period
     * @deprecated since version 0.6 use query instead
     */
    async list(entry: string, start: bigint, stop: bigint): Promise<{ size: bigint, timestamp: bigint }[]> {
        const {data} = await this.httpClient.get(`/b/${this.name}/${entry}/list?start=${start}&stop=${stop}`);
        return data.records.map((rec: any) => {
            return {
                size: BigInt(rec.size),
                timestamp: BigInt(rec.ts)
            };
        });
    }

    /**
     * Query records for a time interval as generator
     * @param entry entry name
     * @param entry {string} name of the entry
     * @param start {BigInt} start point of the time period
     * @param stop {BigInt} stop point of the time period
     * @param ttl {number} TTL of query on the server side
     * @example
     * for await (const record in bucket.query("entry-1", start, stop)) {
     *   console.log(record.ts, record.size);
     *   const content = await record.read();
     *   // or use pipe
     *   const fileStream = fs.createWriteStream(`ts_${record.size}.txt`);
     *   record.pipe(fileStream);
     * }
     */
    async* query(entry: string, start?: bigint, stop?: bigint, ttl?: number) {
        const params: string[] = [];
        if (start !== undefined) {
            params.push(`start=${start}`);
        }
        if (stop !== undefined) {
            params.push(`stop=${stop}`);
        }
        if (ttl !== undefined) {
            params.push(`ttl=${ttl}`);
        }

        const url = `/b/${this.name}/${entry}/q?` + params.join("&");
        const resp = await this.httpClient.get(url);
        const {id} = resp.data;
        const {httpClient, name} = this;
        yield* (async function* () {
            let last = false;
            while (!last) {
                const {
                    headers,
                    data,
                } = await httpClient.get(`/b/${name}/${entry}?q=${id}`, {responseType: "stream"});

                if (data.statusCode == 202) {
                    break;
                }

                yield new Record(BigInt(headers["x-reduct-time"]), BigInt(headers["content-length"]), data);
                last = headers["x-reduct-last"] == "1";
            }
        })();
    }
}
