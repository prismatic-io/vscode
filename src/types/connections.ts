export interface ConnectionInput {
  name: string;
  label: string;
  hasValue: boolean;
  type: string;
}

export interface Connection {
  id: string;
  label: string;
  stableKey: string;
  status: string;
  authorizationUrl: string | null;
  oauth2Type: string | null;
  scopes: string | null;
  inputs: ConnectionInput[];
  isTestCredential: boolean;
  scopedConfigVariableId: string | null;
  variableScope: string | null;
  managedBy: string | null;
  componentKey: string | null;
  componentLabel: string | null;
  connectionKey: string | null;
  isInlineCNI: boolean;
  onPremiseConnectionConfig: unknown | null;
  scopedConnectionKey: string | null;
  scopedConnectionLabel: string | null;
  scopedComponentLabel: string | null;
  scopedConnectionIsInlineCNI: boolean;
}
