import type { SourceSpan } from "../diagnostics/sourceSpan.js";

export type TatNode =
  | ProgramNode
  | ImportNode
  | ExportNode
  | BindingNode
  | NodeDefinitionNode
  | BridgeDefinitionNode
  | RelationshipNode
  | DirectiveNode
  | FlowNode
  | FlowBodyNode
  | GateNode
  | FlowStepNode
  | ProjectionChainNode
  | InvocationNode
  | AssignmentNode
  | ObjectNode
  | ObjectEntryNode
  | ArrayNode
  | IdentifierNode
  | LiteralNode
  | PathNode
  | ExpressionNode;

export interface ProgramNode {
  kind: "Program";
  body: TatNode[];
  source?: SourceSpan;
}

export interface ImportNode {
  kind: "Import";
  imports: IdentifierNode[];
  from: StringLiteralNode;
  source?: SourceSpan;
}

export interface ExportNode {
  kind: "Export";
  names: IdentifierNode[];
  source?: SourceSpan;
}

export interface BindingNode {
  kind: "Binding";
  name: IdentifierNode;
  value: TatNode;
  source?: SourceSpan;
}

export type NodeEntityType = "node" | "context" | "hook";

export interface NodeDefinitionNode {
  kind: "NodeDefinition";
  entityType: NodeEntityType;
  body: ObjectNode;
  source?: SourceSpan;
}

export interface BridgeDefinitionNode {
  kind: "BridgeDefinition";
  body: ObjectNode;
  source?: SourceSpan;
}

export type RelationshipNode =
  | ExplicitEdgeRelationshipNode
  | ImplicitEdgeRelationshipNode
  | ImplicitGraphRelationshipNode
  | ContextualGraphRelationshipNode;

export interface ExplicitEdgeRelationshipNode {
  kind: "Relationship";
  relationshipKind: "edge";
  explicit: true;
  from: IdentifierNode | PathNode;
  relation: IdentifierNode | LiteralNode;
  to: IdentifierNode | PathNode;
  body?: never;
  source?: SourceSpan;
}

export interface ImplicitEdgeRelationshipNode {
  kind: "Relationship";
  relationshipKind: "edge";
  explicit: false;
  from: IdentifierNode | PathNode;
  to: IdentifierNode | PathNode;
  source?: SourceSpan;
}

export interface ImplicitGraphRelationshipNode {
  kind: "Relationship";
  relationshipKind: "graph";
  explicit: false;
  left: IdentifierNode | PathNode;
  right: IdentifierNode | PathNode;
  body?: ObjectNode;
  source?: SourceSpan;
}

export interface ContextualGraphRelationshipNode {
  kind: "Relationship";
  relationshipKind: "graph";
  explicit: true;
  left: IdentifierNode | PathNode;
  context: IdentifierNode | PathNode;
  right: IdentifierNode | PathNode;
  body?: ObjectNode;
  source?: SourceSpan;
}

export type DirectiveName =
  | "seed"
  | "query"
  | "derive"
  | "graft"
  | "prune"
  | "update"
  | "action"
  | "project"
  | "inject"
  | "repeat"
  | "when"
  | "traverse"
  | "match"
  | "who"
  | "what"
  | "why"
  | "how"
  | (string & {});

export interface DirectiveNode {
  kind: "Directive";
  name: DirectiveName;
  args: TatNode[];
  body?: ObjectNode | FlowBodyNode;
  source?: SourceSpan;
}

export interface FlowNode {
  kind: "Flow";
  sourceNode: TatNode;
  steps: FlowStepNode[];
  source?: SourceSpan;
}

export type FlowStepNode =
  | MutationFlowStepNode
  | InjectionFlowStepNode
  | ProjectionFlowStepNode
  | GateNode;

export interface MutationFlowStepNode {
  kind: "FlowStep";
  operator: "->";
  value: DirectiveNode | InvocationNode | RelationshipNode;
  source?: SourceSpan;
}

export interface InjectionFlowStepNode {
  kind: "FlowStep";
  operator: "<-";
  value: DirectiveNode;
  source?: SourceSpan;
}

export interface ProjectionFlowStepNode {
  kind: "FlowStep";
  operator: "<>";
  value: DirectiveNode | InvocationNode;
  source?: SourceSpan;
}

export interface GateNode {
  kind: "Gate";
  operator: "?>" | "!>" | ":>";
  condition?: TatNode;
  source?: SourceSpan;
}

export interface FlowBodyNode {
  kind: "FlowBody";
  steps: FlowStepNode[];
  source?: SourceSpan;
}

export interface ProjectionChainNode {
  kind: "ProjectionChain";
  sourceNode: TatNode;
  mainProjection?: ProjectionFlowStepNode;
  who?: ProjectionFlowStepNode;
  what?: ProjectionFlowStepNode;
  why?: ProjectionFlowStepNode;
  how?: ProjectionFlowStepNode;
  source?: SourceSpan;
}

export interface InvocationNode {
  kind: "Invocation";
  callee: IdentifierNode | PathNode;
  args: TatNode[];
  source?: SourceSpan;
}

export interface AssignmentNode {
  kind: "Assignment";
  target: PathNode | IdentifierNode;
  value: TatNode;
  source?: SourceSpan;
}

export interface ObjectNode {
  kind: "Object";
  entries: ObjectMemberNode[];
  source?: SourceSpan;
}

export type ObjectMemberNode = ObjectEntryNode | AssignmentNode | IdentifierNode | LiteralNode | PathNode;

export interface ObjectEntryNode {
  kind: "ObjectEntry";
  key: IdentifierNode | PathNode | LiteralNode;
  value: TatNode;
  source?: SourceSpan;
}

export interface ArrayNode {
  kind: "Array";
  items: TatNode[];
  source?: SourceSpan;
}

export interface IdentifierNode {
  kind: "Identifier";
  name: string;
  source?: SourceSpan;
}

export type LiteralNode =
  | StringLiteralNode
  | NumberLiteralNode
  | BooleanLiteralNode
  | NullLiteralNode;

export interface StringLiteralNode {
  kind: "Literal";
  literalKind: "string";
  value: string;
  source?: SourceSpan;
}

export interface NumberLiteralNode {
  kind: "Literal";
  literalKind: "number";
  value: number;
  source?: SourceSpan;
}

export interface BooleanLiteralNode {
  kind: "Literal";
  literalKind: "boolean";
  value: boolean;
  source?: SourceSpan;
}

export interface NullLiteralNode {
  kind: "Literal";
  literalKind: "null";
  value: null;
  source?: SourceSpan;
}

export interface PathNode {
  kind: "Path";
  parts: IdentifierNode[];
  source?: SourceSpan;
}

export type ExpressionNode =
  | BinaryExpressionNode
  | UnaryExpressionNode
  | ComparisonExpressionNode
  | FunctionCallExpressionNode
  | TernaryExpressionNode;

export interface BinaryExpressionNode {
  kind: "Expression";
  expressionKind: "binary";
  operator: "+" | "-" | "*" | "/" | "%" | "^" | "&&" | "||" | "in";
  left: TatNode;
  right: TatNode;
  source?: SourceSpan;
}

export interface UnaryExpressionNode {
  kind: "Expression";
  expressionKind: "unary";
  operator: "-" | "!";
  value: TatNode;
  source?: SourceSpan;
}

export interface ComparisonExpressionNode {
  kind: "Expression";
  expressionKind: "comparison";
  operator: "==" | "!=" | "<" | ">" | "<=" | ">=";
  left?: TatNode;
  right: TatNode;
  source?: SourceSpan;
}

export interface FunctionCallExpressionNode {
  kind: "Expression";
  expressionKind: "functionCall";
  name: IdentifierNode;
  args: TatNode[];
  source?: SourceSpan;
}


export interface TernaryExpressionNode {
  kind: "Expression";
  expressionKind: "ternary";
  condition: TatNode;
  whenTrue: TatNode;
  whenFalse: TatNode;
  source?: SourceSpan;
}
