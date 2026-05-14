import { COLON, DCOLON, TCOLON } from "./colon.js";
import { COMMA } from "./comma.js";
import { DDOT, DOT } from "./dot.js";
import { NEWLINE } from "./newline.js";
export { COLON, COMMA, DCOLON, DDOT, DOT, NEWLINE, TCOLON };
export const MULTI_CHAR_SEPARATORS = [TCOLON, DCOLON, DDOT] as const;
export const SINGLE_CHAR_SEPARATORS = [COLON, COMMA, DOT] as const;
