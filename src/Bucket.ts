// @ts-ignore
import {AxiosInstance, AxiosResponse} from "axios";
import {BucketSettings} from "./BucketSettings";
import {BucketInfo} from "./BucketInfo";
import {EntryInfo} from "./EntryInfo";

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
        return this.httpClient.get(`/b/${this.name}`).then((response: AxiosResponse) => {
            const {settings} = response.data;
            return Promise.resolve(BucketSettings.parse(settings));
        });
    }

    /**
     * Set bucket settings
     * @async
     * @param settings {BucketSettings} new settings (you can set a part of settings)
     */
    async setSettings(settings: BucketSettings): Promise<void> {
        return this.httpClient.put(`/b/${this.name}`, BucketSettings.serialize(settings))
            .then(() => Promise.resolve());
    }

    /**
     * Get information about a bucket
     * @async
     * @return {Promise<BucketInfo>}
     */
    async getInfo(): Promise<BucketInfo> {
        return this.httpClient.get(`/b/${this.name}`).then((response: AxiosResponse) => {
            const {info} = response.data;
            return Promise.resolve(BucketInfo.parse(info));
        });
    }

    /**
     * Get entry list
     * @async
     * @return {Promise<EntryInfo>}
     */
    async getEntryList(): Promise<EntryInfo[]> {
        return this.httpClient.get(`/b/${this.name}`).then((response: AxiosResponse) => {
            const {entries} = response.data;
            return Promise.resolve(entries.map((entry: any) => EntryInfo.parse(entry)));
        });
    }

    /**
     * Remove bucket
     * @async
     * @return {Promise<void>}
     */
    async remove(): Promise<void> {
        return this.httpClient.delete(`/b/${this.name}`).then(() => Promise.resolve());
    }

    /**
     * Write a record into an entry
     * @param entry name of the entry
     * @param data {string} data as sting
     * @param ts {Date} timestamp for the record. It is current time if undefined.
     */
    async write(entry: string, data: string, ts?: Date): Promise<void> {
        ts ||= new Date();
        return this.httpClient.post(`/b/${this.name}/${entry}?ts=${ts.getTime() * 1000}`, data).then(() => Promise.resolve());
    }

    /**
     * Read a record from an entry
     * @param entry name of the entry
     * @param ts {Date} timestamp of record. Get the latest onr, if undefined
     */
    async read(entry: string, ts?: Date): Promise<string> {
        let url = `/b/${this.name}/${entry}`;
        if (ts !== undefined) {
            url += `?ts=${ts.getTime() * 1000}`;
        }
        return this.httpClient.get(url).then((resp: AxiosResponse) => Promise.resolve(resp.data));
    }
}
