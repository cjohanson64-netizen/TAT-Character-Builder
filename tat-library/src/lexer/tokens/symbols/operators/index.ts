import { COLON_EQUALS, EQUALS } from "./assignment.js";
import { PERCENT, PLUS, MINUS, SLASH, STAR } from "./arithmetic.js";
import { EQ2, EQ3, GTE, LTE, NEQ2, NEQ3 } from "./comparison.js";
import { AND, BANG, OR } from "./logical.js";
import { ARROW, INJECT_FLOW, PROJECT } from "./pipeline.js";
export {
  AND,
  ARROW,
  INJECT_FLOW,
  BANG,
  COLON_EQUALS,
  EQ2,
  EQ3,
  EQUALS,
  GTE,
  LTE,
  MINUS,
  NEQ2,
  NEQ3,
  OR,
  PERCENT,
  PLUS,
  PROJECT,
  SLASH,
  STAR,
};
export const MULTI_CHAR_OPERATORS = [EQ3, NEQ3, EQ2, NEQ2, LTE, GTE, AND, OR, COLON_EQUALS, ARROW, INJECT_FLOW, PROJECT] as const;
export const SINGLE_CHAR_OPERATORS = [BANG, PLUS, STAR, PERCENT, MINUS, EQUALS] as const;
