"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AVAILABLE_COMMANDS = void 0;
exports.parseSlashCommand = parseSlashCommand;
exports.hasRequiredPermission = hasRequiredPermission;
exports.AVAILABLE_COMMANDS = [
    { command: "/review", description: "Posts a full code review of the pull request" },
    { command: "/summary", description: "Posts a summary of the changes in the pull request" },
    { command: "/help", description: "Shows available commands" },
];
const PERMISSION_RANK = {
    none: 0,
    read: 1,
    triage: 2,
    write: 3,
    maintain: 4,
    admin: 5,
};
function parseSlashCommand(commentBody) {
    const firstLine = commentBody
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.length > 0);
    if (!firstLine)
        return undefined;
    const match = firstLine.match(/^\/(review|summary|help)(?:\s|$)/i);
    if (!match)
        return undefined;
    return match[1].toLowerCase();
}
function hasRequiredPermission(permission, minimumPermission) {
    const userRank = PERMISSION_RANK[permission.toLowerCase()] ?? 0;
    const requiredRank = PERMISSION_RANK[minimumPermission.toLowerCase()] ?? PERMISSION_RANK.write;
    return userRank >= requiredRank;
}
//# sourceMappingURL=commands.js.map