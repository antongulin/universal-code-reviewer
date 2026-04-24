export type ReviewerCommand = "review" | "summary" | "help";
export interface SlashCommand {
    command: `/${ReviewerCommand}`;
    description: string;
}
export declare const AVAILABLE_COMMANDS: SlashCommand[];
export declare function parseSlashCommand(commentBody: string): ReviewerCommand | undefined;
export declare function hasRequiredPermission(permission: string, minimumPermission: string): boolean;
//# sourceMappingURL=commands.d.ts.map