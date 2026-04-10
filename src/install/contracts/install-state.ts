import type {
  CuratedModelKey,
  CuratedModelTransport,
} from "../../constants/models.js";
import type { ManagedConfigScope } from "./managed-config.js";

export interface ManagedInstallStateRecord {
  currentTransport: CuratedModelTransport;
  installerVersion: string;
  lastDurableSetupAt: string;
  selectedModelKey: CuratedModelKey;
  selectedScope: ManagedConfigScope;
}
