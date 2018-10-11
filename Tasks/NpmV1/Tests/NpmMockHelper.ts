import * as path from 'path';

import { TaskLibAnswers, TaskLibAnswerExecResult } from 'vsts-task-lib/mock-answer';
import { TaskMockRunner } from 'vsts-task-lib/mock-run';
import * as mtr from 'vsts-task-lib/mock-toolrunner';
import { debug } from 'vsts-task-lib';

export class NpmMockHelper extends TaskMockRunner {
    private static NpmCmdPath: string = 'c:\\mock\\location\\npm';
    private static NpmCachePath: string = 'c:\\mock\\location\\npm_cache';
    private static AgentBuildDirectory: string = 'c:\\mock\\agent\\work\\build';
    private static BuildBuildId: string = '12345';
    private static CollectionUrl: string = 'https://example.visualstudio.com/defaultcollection';

    public answers: TaskLibAnswers = {
        checkPath: {},
        exec: {},
        exist: {},
        findMatch: {},
        rmRF: {},
        which: {}
    };

    constructor(taskPath: string) {
        super(taskPath);

        this.registerMock('vsts-task-lib/toolrunner', mtr);
        this.setAnswers(this.answers);

        NpmMockHelper._setVariable('Agent.HomeDirectory', 'c:\\agent\\home\\directory');
        NpmMockHelper._setVariable('Build.SourcesDirectory', 'c:\\agent\\home\\directory\\sources');
        NpmMockHelper._setVariable('System.DefaultWorkingDirectory', 'c:\\agent\\home\\directory');
        NpmMockHelper._setVariable('System.TeamFoundationCollectionUri', NpmMockHelper.CollectionUrl);
        NpmMockHelper._setVariable('Agent.BuildDirectory', NpmMockHelper.AgentBuildDirectory);
        NpmMockHelper._setVariable('Build.BuildId', NpmMockHelper.BuildBuildId);
        this.setDebugState(false);

        // mock SYSTEMVSSCONNECtION
        this.mockServiceEndpoint(
            'SYSTEMVSSCONNECTION',
            NpmMockHelper.CollectionUrl,
            {
                parameters: { AccessToken: 'token'},
                scheme: 'OAuth'
            }
        );

        this.mockNpmCommand('config get cache', { code: 0, stdout: NpmMockHelper.NpmCachePath} as TaskLibAnswerExecResult);
        this.mockNpmCommand('--version', { code: 0, stdout: "3.10.10"} as TaskLibAnswerExecResult);
        this._mockNpmConfigList();
        this._setToolPath('npm', NpmMockHelper.NpmCmdPath);
        // mock temp npm path
        const tempNpmPath = path.join(NpmMockHelper.AgentBuildDirectory, 'npm');
        this.answers.exist[tempNpmPath] = true;
        this.answers.rmRF[tempNpmPath] = { success: true };
        const tempNpmrcPath = path.join(tempNpmPath, `${NpmMockHelper.BuildBuildId}.npmrc`);
        this.answers.rmRF[tempNpmrcPath] = { success: true };

        this.registerMock('typed-rest-client/HttpClient', {
            HttpClient: function() {
                return {
                    get: function(url, headers) {
                        return {
                        then: function(handler) {
                            handler({
                                message: {
                                    statusCode: 401,
                                    rawHeaders: ['x-tfs-foo: abc', 'x-content-type-options: nosniff', 'X-Powered-By: ASP.NET']
                                }
                            });
                        }
                        };
                    }
                };
            }
        });

        this.registerLocationHelpersMock();
    }

    public run(noMockTask?: boolean): void {
        super.run(noMockTask);
    }

    public setDebugState(debug: boolean): void {
        NpmMockHelper._setVariable('System.Debug', debug ? 'true' : 'false');
    }

    private static _setVariable(name: string, value: string): void {
        let key = NpmMockHelper._getVariableKey(name);
        process.env[key] = value;
    }

    private static _getVariableKey(name: string): string {
        return name.replace(/\./g, '_').toUpperCase();
    }

    public mockNpmCommand(command: string, result: TaskLibAnswerExecResult) {
        this.answers.exec[`npm ${command}`] = result;
        this.answers.exec[`${NpmMockHelper.NpmCmdPath} ${command}`] = result;
    }

    public mockServiceEndpoint(endpointId: string, url: string, auth: any): void {
        process.env['ENDPOINT_URL_' + endpointId] = url;
        process.env['ENDPOINT_AUTH_' + endpointId] = JSON.stringify(auth);
    }

    public registerLocationHelpersMock() {
        const mockLocationUtils = {
            getPackagingUris: function(input) {
                const collectionUrl: string = "https://vsts/packagesource";
                return {
                    PackagingUris: [collectionUrl],
                    DefaultPackagingUri: collectionUrl
                };
            },
            getWebApiWithProxy: function(serviceUri: string, accessToken?: string) {
                return {
                    vsoClient: {
                        getVersioningData: async function (ApiVersion: string, PackagingAreaName: string, PackageAreaId: string, Obj) {
                            return { requestUrl: 'foobar' };
                        }
                    }
                }
            },
            getSystemAccessToken: function() {
                return "token";
            },
            getFeedRegistryUrl: function(packagingUrl: string, registryType, feedId: string) {
                return packagingUrl + "/" + feedId;
            },
            ProtocolType: {NuGet: 1, Npm: 2, Maven: 3},
            RegistryType: {npm: 1, NuGetV2: 2, NuGetV3: 3}
        };

        this.registerMock('packaging-common/locationUtilities', mockLocationUtils);
        this.registerMock('../locationUtilities', mockLocationUtils);
    }

    private isDebugging() {
        let value = process.env[NpmMockHelper._getVariableKey('System.Debug')];
        return value === 'true';
    }

    private _setToolPath(tool: string, path: string) {
        this.answers.which[tool] = path;
        this.answers.checkPath[path] = true;
    }

    private _mockNpmConfigList() {
        this.mockNpmCommand(`config list`, {
            code: 0,
            stdout: '; cli configs'} as TaskLibAnswerExecResult);

        this.mockNpmCommand(`config list -l`, {
            code: 0,
            stdout: '; debug cli configs'} as TaskLibAnswerExecResult);
    }

    private _registerMockToolRunner() {
        let tmr = require('vsts-task-lib/mock-toolrunner');
        this.registerMock('vsts-task-lib/toolrunner', tmr);
    }
}
