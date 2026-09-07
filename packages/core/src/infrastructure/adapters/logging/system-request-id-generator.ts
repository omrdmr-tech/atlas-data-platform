import { randomUUID } from "node:crypto";

import type {
  RequestIdGenerator,
} from "../../../application/ports/scrape-execution.js";

export class SystemRequestIdGenerator
  implements RequestIdGenerator
{
  public generate(): string {
    return randomUUID();
  }
}
