import { COLLECTIONS, getDb } from "@/lib/auth";

export async function ensureIndexes() {
  const db = await getDb();

  const userCollection = db.collection(COLLECTIONS.USERS);
  await userCollection.createIndex({ username: 1 }, { unique: true });
  await userCollection.createIndex({ email: 1 }, { unique: true });

  const bookCollection = db.collection(COLLECTIONS.BOOKS);
  await bookCollection.createIndex({ title: 1 });
  await bookCollection.createIndex({ author: 1 });
  await bookCollection.createIndex({ status: 1 });

  const borrowCollection = db.collection(COLLECTIONS.BORROWS);
  await borrowCollection.createIndex({ userId: 1, createdAt: -1 });
  await borrowCollection.createIndex({ requestStatus: 1, createdAt: -1 });
}
