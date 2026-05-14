import type { DirectiveNode, TatNode } from "../../ast/nodes.js";

export function isSeedDirective(node: TatNode): node is DirectiveNode {
  return node.kind === "Directive" && node.name === "seed";
}

export function isReadDirective(node: TatNode): node is DirectiveNode {
  return (
    node.kind === "Directive" &&
    (node.name === "derive" ||
      node.name === "query" ||
      node.name === "traverse" ||
      node.name === "match")
  );
}
