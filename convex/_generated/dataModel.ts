import type { GenericDataModel } from "convex/server";
import type { GenericId } from "convex/values";

export type DataModel = GenericDataModel;
export type Id<TableName extends string> = GenericId<TableName>;
export type Doc<TableName extends string> = Record<string, unknown> & {
  _id: Id<TableName>;
  _creationTime: number;
};
