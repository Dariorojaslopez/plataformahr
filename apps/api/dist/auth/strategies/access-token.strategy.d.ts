import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.types';
declare const AccessTokenStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class AccessTokenStrategy extends AccessTokenStrategy_base {
    constructor(config: ConfigService);
    validate(payload: AccessTokenPayload): AuthenticatedUser;
}
export {};
