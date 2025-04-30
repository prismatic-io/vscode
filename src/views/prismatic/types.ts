export interface PrismaticDummyMessage {
  type: "prismatic.dummy";
  payload: string;
}

export interface PrismaticErrorMessage {
  type: "prismatic.error";
  payload: {
    message: string;
    code?: number;
  };
}

export type PrismaticMessage = PrismaticDummyMessage | PrismaticErrorMessage;
