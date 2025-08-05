export type GraphQLMutationErrorType = {
  __typename: "ErrorType";
  field: string;
  messages: Array<string>;
};

export type GraphQLVariables<V> = {
  accessToken: string;
  prismaticUrl: string;
} & V;

export interface GraphQLResponse<T = unknown> {
  data: T;
  errors?: Array<{ message: string }>;
}
