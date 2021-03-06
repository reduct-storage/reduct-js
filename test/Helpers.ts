import {Bucket} from "../src/Bucket";
import {Client} from "../src/Client";
import * as process from "process";

/**
 * Remove all buckets
 * @param client
 */
export const cleanStorage = async (client: Client): Promise<void> => {
    return client.getBucketList()
        .then(buckets => {
            return Promise.all(buckets.map(info => {
                return client.getBucket(info.name).then((bucket: Bucket) => {
                        return bucket.remove();
                    }
                );
            }));
        }).then(() => Promise.resolve());
};

export const makeClient = (): Client => {
    return new Client("http://127.0.0.1:8383", {
        apiToken: process.env.RS_API_TOKEN
    });
};
