import * as path from 'path';
import * as tl from "azure-pipelines-task-lib/task";
import * as nugetUtils from "packaging-common/nuget/Utility";
import * as credProviderUtilities from "packaging-common/nuget/CredentialProviderUtilities"
import { GetExternalAuthInfoArray } from "packaging-common/nuget/CommandHelper";
import { ProtocolType } from "packaging-common/locationUtilities";

// IMPORTANT: This task is nearly identical to the NuGetExeAuthenticate and DotnetAuthenticate tasks.
//            If making a change here, be sure to make the change in those tasks if appropriate.
async function main(): Promise<void> {
    try {
        tl.setResourcePath(path.join(__dirname, 'task.json'));
        tl.setResourcePath(path.join(__dirname, 'node_modules/packaging-common/module.json'));

        // Configure the credential provider for both same-organization feeds and service connections
        const serviceConnections = GetExternalAuthInfoArray('nuGetServiceConnections');
        await credProviderUtilities.configureCredProvider(ProtocolType.NuGet, serviceConnections);

        // MSBuild uses the .exe (.NET Framework) variant of artifacts-credprovider
        const credProviderAssemblyPath = nugetUtils.locateCredentialProvider(true);
        console.log(tl.loc('ConfiguringMSBuildForCredProvider'));
        credProviderUtilities.configureNuGetPluginPaths(credProviderAssemblyPath);
    } catch (error) {
        tl.setResult(tl.TaskResult.Failed, error);
    }
}

main();