export declare enum ProtocolVersion {
    V000Base64Decrypted = "000",
    V001 = "001",
    V002 = "002",
    V003 = "003",
    V004 = "004",
    VersionLength = 3
}
/**
 *  -1 if a < b
 *  0 if a == b
 *  1 if a > b
 */
export declare function compareVersions(a: ProtocolVersion, b: ProtocolVersion): number;
export declare function leftVersionGreaterThanOrEqualToRight(a: ProtocolVersion, b: ProtocolVersion): boolean;
export declare function isVersionLessThanOrEqualTo(input: ProtocolVersion, compareTo: ProtocolVersion): boolean;
