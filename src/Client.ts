/**
 * Represents HTTP Client for Reduct Storage API
 * @class
 */
import {ServerInfo} from "./ServerInfo";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import axios, {AxiosInstance, AxiosResponse, AxiosError} from "axios";
import {APIError} from "./APIError";
import {BucketInfo} from "./BucketInfo";
import {BucketSettings} from "./BucketSettings";
import {Bucket} from "./Bucket";

/**
 * Options
 */
export type ClientOptions = {
    apiToken?: string;   // API token for authentication
    timeout?: number;    // communication timeout
}

export class Client {
    private readonly httpClient: AxiosInstance;

    /**
     * HTTP Client for Reduct Storage
     * @param url URL to the storage
     * @param options
     */
    constructor(url: string, options: ClientOptions = {}) {
        this.httpClient = axios.create({
            baseURL: url,
            timeout: options.timeout,
        });

        this.httpClient.interceptors.response.use(
            (response: AxiosResponse) => response,
            async (error: AxiosError) => {
                if (error.config && error.response && error.response.status == 401 && options.apiToken) {
                    try {
                        // Use axios instead the instance not to cycle with 401 error
                        const resp: AxiosResponse = await axios.post("/auth/refresh", {}, {
                            baseURL: url,
                            timeout: options.timeout,
                            headers: {
                                "Authorization": `Bearer ${options.apiToken}`
                            }
                        });

                        const {access_token} = resp.data;
                        if (access_token === undefined) {
                            throw {message: "No access token in response"};
                        }

                        error.config.headers ||= {};
                        error.config.headers["Authorization"] = `Bearer ${access_token}`;
                        this.httpClient.defaults.headers.common["Authorization"] = `Bearer ${access_token}`;
                        // Repiet request after token updated
                        return this.httpClient.request(error.config);
                    } catch (error) {
                        if (error instanceof AxiosError) {
                            throw APIError.from(error);
                        }

                        throw error;
                    }
                }

                throw APIError.from(error);
            }
        );
    }

    /**
     * Get server information
     * @async
     * @return {Promise<ServerInfo>} the data about the server
     */
    async getInfo(): Promise<ServerInfo> {
        const {data} = await this.httpClient.get("/info");
        return ServerInfo.parse(data);
    }

    /**
     * Get list of buckets
     * @async
     * @return {BucketInfo[]}
     * @see BucketInfo
     */
    async getBucketList(): Promise<BucketInfo[]> {
        const {data} = await this.httpClient.get("/list");
        return data.buckets.map((bucket: any) => BucketInfo.parse(bucket));
    }

    /**
     * Create a new bucket
     * @param name name of the bucket
     * @param settings optional settings
     * @return {Promise<Bucket>}
     */
    async createBucket(name: string, settings?: BucketSettings): Promise<Bucket> {
        await this.httpClient.post(`/b/${name}`, settings ? BucketSettings.serialize(settings) : undefined);
        return new Bucket(name, this.httpClient);
    }

    /**
     * Get a bucket by name
     * @param name name of the bucket
     * @return {Promise<Bucket>}
     */
    async getBucket(name: string): Promise<Bucket> {
        await this.httpClient.get(`/b/${name}`);
        return new Bucket(name, this.httpClient);
    }

    /**
     * Try to create a bucket and get it if it already exists
     * @param name name of the bucket
     * @param settings optional settings
     * @return {Promise<Bucket>}
     */
    async getOrCreateBucket(name: string, settings?: BucketSettings): Promise<Bucket> {
        try {
            return await this.createBucket(name, settings);
        } catch (error) {
            if (error instanceof APIError && error.status === 409) {
                return await this.getBucket(name);
            }

            throw error; // pass exception forward
        }
    }
}
