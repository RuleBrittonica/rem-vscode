// Function to generate new code based on the original code
export function generateNewCode(originalCode: string): string {
    // For now, just return the original code with a comment
    // TODO: Replace this with the actual code transformation logic later (based
    // on the REM-CLI I need to write)
    return `${originalCode}`;
}

export function addComments (originalCode: string, startComment: string, endComment: string): string {
    let newCode: string =
        `${startComment}
         ${originalCode}
         ${endComment}`;
    return newCode;
}