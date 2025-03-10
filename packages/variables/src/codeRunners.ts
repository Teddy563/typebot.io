import ivm from "isolated-vm";
import { getOrCreateIsolate } from "./getOrCreateIsolate";
import { parseGuessedValueType } from "./parseGuessedValueType";
import type { Variable } from "./schemas";

export const createInlineSyncCodeRunner = ({
  variables,
}: { variables: Variable[] }) => {
  const isolate = getOrCreateIsolate();
  const context = isolate.createContextSync();
  const jail = context.global;
  jail.setSync("global", jail.derefInto());
  variables.forEach((v) => {
    jail.setSync(v.id, parseTransferrableValue(parseGuessedValueType(v.value)));
  });
  return (code: string) =>
    context.evalClosureSync(
      `return (function() {
    return new Function($0)();
  }())`,
      [code],
      { result: { copy: true }, timeout: 10000 },
    );
};

export const createHttpReqResponseMappingRunner = (response: unknown) => {
  if (
    response === null ||
    typeof response !== "object" ||
    Array.isArray(response)
  )
    return;
  const isolate = getOrCreateIsolate();
  const context = isolate.createContextSync();
  const jail = context.global;
  jail.setSync("global", jail.derefInto());
  jail.setSync("response", new ivm.ExternalCopy(response).copyInto());
  return (expression: string) => {
    return context.evalClosureSync(
      `globalThis.evaluateExpression = function(expression) {
        try {
          // Use Function to safely evaluate the expression
          const func = new Function('statusCode', 'data', 'return (' + expression + ')');
          return func(response.statusCode, response.data);
        } catch (err) {
          throw new Error('Invalid expression: ' + err.message);
        }
      };
      return evaluateExpression.apply(null, arguments);`,
      [expression],
      {
        result: { copy: true },
        timeout: 10000,
      },
    );
  };
};

export const parseTransferrableValue = (value: unknown) => {
  if (typeof value === "object") {
    return new ivm.ExternalCopy(value).copyInto();
  }
  return value;
};
