#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const architect_1 = require("@angular-devkit/architect");
const node_1 = require("@angular-devkit/architect/node");
const core_1 = require("@angular-devkit/core");
const node_2 = require("@angular-devkit/core/node");
const fs_1 = require("fs");
const minimist = require("minimist");
const path = require("path");
const operators_1 = require("rxjs/operators");
const progress_1 = require("../src/progress");
function findUp(names, from) {
    if (!Array.isArray(names)) {
        names = [names];
    }
    const root = path.parse(from).root;
    let currentDir = from;
    while (currentDir && currentDir !== root) {
        for (const name of names) {
            const p = path.join(currentDir, name);
            if (fs_1.existsSync(p)) {
                return p;
            }
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}
/**
 * Show usage of the CLI tool, and exit the process.
 */
function usage(logger, exitCode = 0) {
    logger.info(core_1.tags.stripIndent `
    architect [project][:target][:configuration] [options, ...]

    Run a project target.
    If project/target/configuration are not specified, the workspace defaults will be used.

    Options:
        --help              Show available options for project target.
                            Shows this message instead when ran without the run argument.


    Any additional option is passed the target, overriding existing options.
  `);
    process.exit(exitCode);
    throw 0; // The node typing sometimes don't have a never type for process.exit().
}
function _targetStringFromTarget({ project, target, configuration }) {
    return `${project}:${target}${configuration !== undefined ? ':' + configuration : ''}`;
}
async function _executeTarget(parentLogger, workspace, root, argv, registry) {
    const architectHost = new node_1.WorkspaceNodeModulesArchitectHost(workspace, root);
    const architect = new architect_1.index2.Architect(architectHost, registry);
    // Split a target into its parts.
    const targetStr = argv._.shift() || '';
    const [project, target, configuration] = targetStr.split(':');
    const targetSpec = { project, target, configuration };
    delete argv['help'];
    delete argv['_'];
    const logger = new core_1.logging.Logger('jobs');
    const logs = [];
    logger.subscribe(entry => logs.push(Object.assign({}, entry, { message: `${entry.name}: ` + entry.message })));
    const run = await architect.scheduleTarget(targetSpec, argv, { logger });
    const bars = new progress_1.MultiProgressBar(':name :bar (:current/:total) :status');
    run.progress.subscribe(update => {
        const data = bars.get(update.id) || {
            id: update.id,
            builder: update.builder,
            target: update.target,
            status: update.status || '',
            name: ((update.target ? _targetStringFromTarget(update.target) : update.builder.name)
                + ' '.repeat(80)).substr(0, 40),
        };
        if (update.status !== undefined) {
            data.status = update.status;
        }
        switch (update.state) {
            case architect_1.index2.BuilderProgressState.Error:
                data.status = 'Error: ' + update.error;
                bars.update(update.id, data);
                break;
            case architect_1.index2.BuilderProgressState.Stopped:
                data.status = 'Done.';
                bars.complete(update.id);
                bars.update(update.id, data, update.total, update.total);
                break;
            case architect_1.index2.BuilderProgressState.Waiting:
                bars.update(update.id, data);
                break;
            case architect_1.index2.BuilderProgressState.Running:
                bars.update(update.id, data, update.current, update.total);
                break;
        }
        bars.render();
    });
    // Wait for full completion of the builder.
    try {
        const { success } = await run.output.pipe(operators_1.tap(result => {
            if (result.success) {
                parentLogger.info(core_1.terminal.green('SUCCESS'));
            }
            else {
                parentLogger.info(core_1.terminal.yellow('FAILURE'));
            }
            parentLogger.info('Result: ' + JSON.stringify(Object.assign({}, result, { info: undefined }), null, 4));
            parentLogger.info('\nLogs:');
            logs.forEach(l => parentLogger.next(l));
            logs.splice(0);
        })).toPromise();
        await run.stop();
        bars.terminate();
        return success ? 0 : 1;
    }
    catch (err) {
        parentLogger.info(core_1.terminal.red('ERROR'));
        parentLogger.info('\nLogs:');
        logs.forEach(l => parentLogger.next(l));
        parentLogger.fatal('Exception:');
        parentLogger.fatal(err.stack);
        return 2;
    }
}
async function main(args) {
    /** Parse the command line. */
    const argv = minimist(args, { boolean: ['help'] });
    /** Create the DevKit Logger used through the CLI. */
    const logger = node_2.createConsoleLogger(argv['verbose']);
    // Check the target.
    const targetStr = argv._[0] || '';
    if (!targetStr || argv.help) {
        // Show architect usage if there's no target.
        usage(logger);
    }
    // Load workspace configuration file.
    const currentPath = process.cwd();
    const configFileNames = [
        'angular.json',
        '.angular.json',
        'workspace.json',
        '.workspace.json',
    ];
    const configFilePath = findUp(configFileNames, currentPath);
    if (!configFilePath) {
        logger.fatal(`Workspace configuration file (${configFileNames.join(', ')}) cannot be found in `
            + `'${currentPath}' or in parent directories.`);
        return 3;
    }
    const root = path.dirname(configFilePath);
    const configContent = fs_1.readFileSync(configFilePath, 'utf-8');
    const workspaceJson = JSON.parse(configContent);
    const registry = new core_1.schema.CoreSchemaRegistry();
    registry.addPostTransform(core_1.schema.transforms.addUndefinedDefaults);
    const host = new node_2.NodeJsSyncHost();
    const workspace = new core_1.experimental.workspace.Workspace(core_1.normalize(root), host);
    await workspace.loadWorkspaceFromJson(workspaceJson).toPromise();
    // Clear the console.
    process.stdout.write('\u001Bc');
    return await _executeTarget(logger, workspace, root, argv, registry);
}
main(process.argv.slice(2))
    .then(code => {
    process.exit(code);
}, err => {
    console.error('Error: ' + err.stack || err.message || err);
    process.exit(-1);
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXJjaGl0ZWN0LmpzIiwic291cmNlUm9vdCI6Ii4vIiwic291cmNlcyI6WyJwYWNrYWdlcy9hbmd1bGFyX2RldmtpdC9hcmNoaXRlY3RfY2xpL2Jpbi9hcmNoaXRlY3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBUUEseURBQW1EO0FBQ25ELHlEQUFtRjtBQUNuRiwrQ0FROEI7QUFDOUIsb0RBQWdGO0FBQ2hGLDJCQUE4QztBQUM5QyxxQ0FBcUM7QUFDckMsNkJBQTZCO0FBQzdCLDhDQUEyQztBQUMzQyw4Q0FBbUQ7QUFHbkQsU0FBUyxNQUFNLENBQUMsS0FBd0IsRUFBRSxJQUFZO0lBQ3BELElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxFQUFFO1FBQ3pCLEtBQUssR0FBRyxDQUFDLEtBQUssQ0FBQyxDQUFDO0tBQ2pCO0lBQ0QsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFFbkMsSUFBSSxVQUFVLEdBQUcsSUFBSSxDQUFDO0lBQ3RCLE9BQU8sVUFBVSxJQUFJLFVBQVUsS0FBSyxJQUFJLEVBQUU7UUFDeEMsS0FBSyxNQUFNLElBQUksSUFBSSxLQUFLLEVBQUU7WUFDeEIsTUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdEMsSUFBSSxlQUFVLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQ2pCLE9BQU8sQ0FBQyxDQUFDO2FBQ1Y7U0FDRjtRQUVELFVBQVUsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxDQUFDO0tBQ3ZDO0lBRUQsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQ7O0dBRUc7QUFDSCxTQUFTLEtBQUssQ0FBQyxNQUFzQixFQUFFLFFBQVEsR0FBRyxDQUFDO0lBQ2pELE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBSSxDQUFDLFdBQVcsQ0FBQTs7Ozs7Ozs7Ozs7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LFFBQVEsR0FBRyxJQUFJLGFBQU0sQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQ2pELFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxhQUFNLENBQUMsVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFFbEUsTUFBTSxJQUFJLEdBQUcsSUFBSSxxQkFBYyxFQUFFLENBQUM7SUFDbEMsTUFBTSxTQUFTLEdBQUcsSUFBSSxtQkFBWSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsZ0JBQVMsQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUU5RSxNQUFNLFNBQVMsQ0FBQyxxQkFBcUIsQ0FBQyxhQUFhLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztJQUVqRSxxQkFBcUI7SUFDckIsT0FBTyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLENBQUM7SUFFaEMsT0FBTyxNQUFNLGNBQWMsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDdkUsQ0FBQztBQUVELElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztLQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7SUFDWCxPQUFPLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ3JCLENBQUMsRUFBRSxHQUFHLENBQUMsRUFBRTtJQUNQLE9BQU8sQ0FBQyxLQUFLLENBQUMsU0FBUyxHQUFHLEdBQUcsQ0FBQyxLQUFLLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxHQUFHLENBQUMsQ0FBQztJQUMzRCxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDbkIsQ0FBQyxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIjIS91c3IvYmluL2VudiBub2RlXG4vKipcbiAqIEBsaWNlbnNlXG4gKiBDb3B5cmlnaHQgR29vZ2xlIEluYy4gQWxsIFJpZ2h0cyBSZXNlcnZlZC5cbiAqXG4gKiBVc2Ugb2YgdGhpcyBzb3VyY2UgY29kZSBpcyBnb3Zlcm5lZCBieSBhbiBNSVQtc3R5bGUgbGljZW5zZSB0aGF0IGNhbiBiZVxuICogZm91bmQgaW4gdGhlIExJQ0VOU0UgZmlsZSBhdCBodHRwczovL2FuZ3VsYXIuaW8vbGljZW5zZVxuICovXG5pbXBvcnQgeyBpbmRleDIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvYXJjaGl0ZWN0JztcbmltcG9ydCB7IFdvcmtzcGFjZU5vZGVNb2R1bGVzQXJjaGl0ZWN0SG9zdCB9IGZyb20gJ0Bhbmd1bGFyLWRldmtpdC9hcmNoaXRlY3Qvbm9kZSc7XG5pbXBvcnQge1xuICBkaXJuYW1lLFxuICBleHBlcmltZW50YWwsXG4gIGpzb24sXG4gIGxvZ2dpbmcsXG4gIG5vcm1hbGl6ZSxcbiAgc2NoZW1hLFxuICB0YWdzLCB0ZXJtaW5hbCxcbn0gZnJvbSAnQGFuZ3VsYXItZGV2a2l0L2NvcmUnO1xuaW1wb3J0IHsgTm9kZUpzU3luY0hvc3QsIGNyZWF0ZUNvbnNvbGVMb2dnZXIgfSBmcm9tICdAYW5ndWxhci1kZXZraXQvY29yZS9ub2RlJztcbmltcG9ydCB7IGV4aXN0c1N5bmMsIHJlYWRGaWxlU3luYyB9IGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIG1pbmltaXN0IGZyb20gJ21pbmltaXN0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XG5pbXBvcnQgeyBsYXN0LCB0YXAgfSBmcm9tICdyeGpzL29wZXJhdG9ycyc7XG5pbXBvcnQgeyBNdWx0aVByb2dyZXNzQmFyIH0gZnJvbSAnLi4vc3JjL3Byb2dyZXNzJztcblxuXG5mdW5jdGlvbiBmaW5kVXAobmFtZXM6IHN0cmluZyB8IHN0cmluZ1tdLCBmcm9tOiBzdHJpbmcpIHtcbiAgaWYgKCFBcnJheS5pc0FycmF5KG5hbWVzKSkge1xuICAgIG5hbWVzID0gW25hbWVzXTtcbiAgfVxuICBjb25zdCByb290ID0gcGF0aC5wYXJzZShmcm9tKS5yb290O1xuXG4gIGxldCBjdXJyZW50RGlyID0gZnJvbTtcbiAgd2hpbGUgKGN1cnJlbnREaXIgJiYgY3VycmVudERpciAhPT0gcm9vdCkge1xuICAgIGZvciAoY29uc3QgbmFtZSBvZiBuYW1lcykge1xuICAgICAgY29uc3QgcCA9IHBhdGguam9pbihjdXJyZW50RGlyLCBuYW1lKTtcbiAgICAgIGlmIChleGlzdHNTeW5jKHApKSB7XG4gICAgICAgIHJldHVybiBwO1xuICAgICAgfVxuICAgIH1cblxuICAgIGN1cnJlbnREaXIgPSBwYXRoLmRpcm5hbWUoY3VycmVudERpcik7XG4gIH1cblxuICByZXR1cm4gbnVsbDtcbn1cblxuLyoqXG4gKiBTaG93IHVzYWdlIG9mIHRoZSBDTEkgdG9vbCwgYW5kIGV4aXQgdGhlIHByb2Nlc3MuXG4gKi9cbmZ1bmN0aW9uIHVzYWdlKGxvZ2dlcjogbG9nZ2luZy5Mb2dnZXIsIGV4aXRDb2RlID0gMCk6IG5ldmVyIHtcbiAgbG9nZ2VyLmluZm8odGFncy5zdHJpcEluZGVudGBcbiAgICBhcmNoaXRlY3QgW3Byb2plY3RdWzp0YXJnZXRdWzpjb25maWd1cmF0aW9uXSBbb3B0aW9ucywgLi4uXVxuXG4gICAgUnVuIGEgcHJvamVjdCB0YXJnZXQuXG4gICAgSWYgcHJvamVjdC90YXJnZXQvY29uZmlndXJhdGlvbiBhcmUgbm90IHNwZWNpZmllZCwgdGhlIHdvcmtzcGFjZSBkZWZhdWx0cyB3aWxsIGJlIHVzZWQuXG5cbiAgICBPcHRpb25zOlxuICAgICAgICAtLWhlbHAgICAgICAgICAgICAgIFNob3cgYXZhaWxhYmxlIG9wdGlvbnMgZm9yIHByb2plY3QgdGFyZ2V0LlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFNob3dzIHRoaXMgbWVzc2FnZSBpbnN0ZWFkIHdoZW4gcmFuIHdpdGhvdXQgdGhlIHJ1biBhcmd1bWVudC5cblxuXG4gICAgQW55IGFkZGl0aW9uYWwgb3B0aW9uIGlzIHBhc3NlZCB0aGUgdGFyZ2V0LCBvdmVycmlkaW5nIGV4aXN0aW5nIG9wdGlvbnMuXG4gIGApO1xuXG4gIHByb2Nlc3MuZXhpdChleGl0Q29kZSk7XG4gIHRocm93IDA7ICAvLyBUaGUgbm9kZSB0eXBpbmcgc29tZXRpbWVzIGRvbid0IGhhdmUgYSBuZXZlciB0eXBlIGZvciBwcm9jZXNzLmV4aXQoKS5cbn1cblxuZnVuY3Rpb24gX3RhcmdldFN0cmluZ0Zyb21UYXJnZXQoe3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbn06IGluZGV4Mi5UYXJnZXQpIHtcbiAgcmV0dXJuIGAke3Byb2plY3R9OiR7dGFyZ2V0fSR7Y29uZmlndXJhdGlvbiAhPT0gdW5kZWZpbmVkID8gJzonICsgY29uZmlndXJhdGlvbiA6ICcnfWA7XG59XG5cblxuaW50ZXJmYWNlIEJhckluZm8ge1xuICBzdGF0dXM/OiBzdHJpbmc7XG4gIGJ1aWxkZXI6IGluZGV4Mi5CdWlsZGVySW5mbztcbiAgdGFyZ2V0PzogaW5kZXgyLlRhcmdldDtcbn1cblxuXG5hc3luYyBmdW5jdGlvbiBfZXhlY3V0ZVRhcmdldChcbiAgcGFyZW50TG9nZ2VyOiBsb2dnaW5nLkxvZ2dlcixcbiAgd29ya3NwYWNlOiBleHBlcmltZW50YWwud29ya3NwYWNlLldvcmtzcGFjZSxcbiAgcm9vdDogc3RyaW5nLFxuICBhcmd2OiBtaW5pbWlzdC5QYXJzZWRBcmdzLFxuICByZWdpc3RyeToganNvbi5zY2hlbWEuU2NoZW1hUmVnaXN0cnksXG4pIHtcbiAgY29uc3QgYXJjaGl0ZWN0SG9zdCA9IG5ldyBXb3Jrc3BhY2VOb2RlTW9kdWxlc0FyY2hpdGVjdEhvc3Qod29ya3NwYWNlLCByb290KTtcbiAgY29uc3QgYXJjaGl0ZWN0ID0gbmV3IGluZGV4Mi5BcmNoaXRlY3QoYXJjaGl0ZWN0SG9zdCwgcmVnaXN0cnkpO1xuXG4gIC8vIFNwbGl0IGEgdGFyZ2V0IGludG8gaXRzIHBhcnRzLlxuICBjb25zdCB0YXJnZXRTdHIgPSBhcmd2Ll8uc2hpZnQoKSB8fCAnJztcbiAgY29uc3QgW3Byb2plY3QsIHRhcmdldCwgY29uZmlndXJhdGlvbl0gPSB0YXJnZXRTdHIuc3BsaXQoJzonKTtcbiAgY29uc3QgdGFyZ2V0U3BlYyA9IHsgcHJvamVjdCwgdGFyZ2V0LCBjb25maWd1cmF0aW9uIH07XG5cbiAgZGVsZXRlIGFyZ3ZbJ2hlbHAnXTtcbiAgZGVsZXRlIGFyZ3ZbJ18nXTtcblxuICBjb25zdCBsb2dnZXIgPSBuZXcgbG9nZ2luZy5Mb2dnZXIoJ2pvYnMnKTtcbiAgY29uc3QgbG9nczogbG9nZ2luZy5Mb2dFbnRyeVtdID0gW107XG4gIGxvZ2dlci5zdWJzY3JpYmUoZW50cnkgPT4gbG9ncy5wdXNoKHsgLi4uZW50cnksIG1lc3NhZ2U6IGAke2VudHJ5Lm5hbWV9OiBgICsgZW50cnkubWVzc2FnZSB9KSk7XG5cbiAgY29uc3QgcnVuID0gYXdhaXQgYXJjaGl0ZWN0LnNjaGVkdWxlVGFyZ2V0KHRhcmdldFNwZWMsIGFyZ3YsIHsgbG9nZ2VyIH0pO1xuICBjb25zdCBiYXJzID0gbmV3IE11bHRpUHJvZ3Jlc3NCYXI8bnVtYmVyLCBCYXJJbmZvPignOm5hbWUgOmJhciAoOmN1cnJlbnQvOnRvdGFsKSA6c3RhdHVzJyk7XG5cbiAgcnVuLnByb2dyZXNzLnN1YnNjcmliZShcbiAgICB1cGRhdGUgPT4ge1xuICAgICAgY29uc3QgZGF0YSA9IGJhcnMuZ2V0KHVwZGF0ZS5pZCkgfHwge1xuICAgICAgICBpZDogdXBkYXRlLmlkLFxuICAgICAgICBidWlsZGVyOiB1cGRhdGUuYnVpbGRlcixcbiAgICAgICAgdGFyZ2V0OiB1cGRhdGUudGFyZ2V0LFxuICAgICAgICBzdGF0dXM6IHVwZGF0ZS5zdGF0dXMgfHwgJycsXG4gICAgICAgIG5hbWU6ICgodXBkYXRlLnRhcmdldCA/IF90YXJnZXRTdHJpbmdGcm9tVGFyZ2V0KHVwZGF0ZS50YXJnZXQpIDogdXBkYXRlLmJ1aWxkZXIubmFtZSlcbiAgICAgICAgICAgICAgICArICcgJy5yZXBlYXQoODApXG4gICAgICAgICAgICAgICkuc3Vic3RyKDAsIDQwKSxcbiAgICAgIH07XG5cbiAgICAgIGlmICh1cGRhdGUuc3RhdHVzICE9PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZGF0YS5zdGF0dXMgPSB1cGRhdGUuc3RhdHVzO1xuICAgICAgfVxuXG4gICAgICBzd2l0Y2ggKHVwZGF0ZS5zdGF0ZSkge1xuICAgICAgICBjYXNlIGluZGV4Mi5CdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5FcnJvcjpcbiAgICAgICAgICBkYXRhLnN0YXR1cyA9ICdFcnJvcjogJyArIHVwZGF0ZS5lcnJvcjtcbiAgICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEpO1xuICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgIGNhc2UgaW5kZXgyLkJ1aWxkZXJQcm9ncmVzc1N0YXRlLlN0b3BwZWQ6XG4gICAgICAgICAgZGF0YS5zdGF0dXMgPSAnRG9uZS4nO1xuICAgICAgICAgIGJhcnMuY29tcGxldGUodXBkYXRlLmlkKTtcbiAgICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS50b3RhbCwgdXBkYXRlLnRvdGFsKTtcbiAgICAgICAgICBicmVhaztcblxuICAgICAgICBjYXNlIGluZGV4Mi5CdWlsZGVyUHJvZ3Jlc3NTdGF0ZS5XYWl0aW5nOlxuICAgICAgICAgIGJhcnMudXBkYXRlKHVwZGF0ZS5pZCwgZGF0YSk7XG4gICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgY2FzZSBpbmRleDIuQnVpbGRlclByb2dyZXNzU3RhdGUuUnVubmluZzpcbiAgICAgICAgICBiYXJzLnVwZGF0ZSh1cGRhdGUuaWQsIGRhdGEsIHVwZGF0ZS5jdXJyZW50LCB1cGRhdGUudG90YWwpO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgfVxuXG4gICAgICBiYXJzLnJlbmRlcigpO1xuICAgIH0sXG4gICk7XG5cbiAgLy8gV2FpdCBmb3IgZnVsbCBjb21wbGV0aW9uIG9mIHRoZSBidWlsZGVyLlxuICB0cnkge1xuICAgIGNvbnN0IHsgc3VjY2VzcyB9ID0gYXdhaXQgcnVuLm91dHB1dC5waXBlKFxuICAgICAgdGFwKHJlc3VsdCA9PiB7XG4gICAgICAgIGlmIChyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKHRlcm1pbmFsLmdyZWVuKCdTVUNDRVNTJykpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHBhcmVudExvZ2dlci5pbmZvKHRlcm1pbmFsLnllbGxvdygnRkFJTFVSRScpKTtcbiAgICAgICAgfVxuICAgICAgICBwYXJlbnRMb2dnZXIuaW5mbygnUmVzdWx0OiAnICsgSlNPTi5zdHJpbmdpZnkoeyAuLi5yZXN1bHQsIGluZm86IHVuZGVmaW5lZCB9LCBudWxsLCA0KSk7XG5cbiAgICAgICAgcGFyZW50TG9nZ2VyLmluZm8oJ1xcbkxvZ3M6Jyk7XG4gICAgICAgIGxvZ3MuZm9yRWFjaChsID0+IHBhcmVudExvZ2dlci5uZXh0KGwpKTtcbiAgICAgICAgbG9ncy5zcGxpY2UoMCk7XG4gICAgICB9KSxcbiAgICApLnRvUHJvbWlzZSgpO1xuXG4gICAgYXdhaXQgcnVuLnN0b3AoKTtcbiAgICBiYXJzLnRlcm1pbmF0ZSgpO1xuXG4gICAgcmV0dXJuIHN1Y2Nlc3MgPyAwIDogMTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgcGFyZW50TG9nZ2VyLmluZm8odGVybWluYWwucmVkKCdFUlJPUicpKTtcbiAgICBwYXJlbnRMb2dnZXIuaW5mbygnXFxuTG9nczonKTtcbiAgICBsb2dzLmZvckVhY2gobCA9PiBwYXJlbnRMb2dnZXIubmV4dChsKSk7XG5cbiAgICBwYXJlbnRMb2dnZXIuZmF0YWwoJ0V4Y2VwdGlvbjonKTtcbiAgICBwYXJlbnRMb2dnZXIuZmF0YWwoZXJyLnN0YWNrKTtcblxuICAgIHJldHVybiAyO1xuICB9XG59XG5cblxuYXN5bmMgZnVuY3Rpb24gbWFpbihhcmdzOiBzdHJpbmdbXSk6IFByb21pc2U8bnVtYmVyPiB7XG4gIC8qKiBQYXJzZSB0aGUgY29tbWFuZCBsaW5lLiAqL1xuICBjb25zdCBhcmd2ID0gbWluaW1pc3QoYXJncywgeyBib29sZWFuOiBbJ2hlbHAnXSB9KTtcblxuICAvKiogQ3JlYXRlIHRoZSBEZXZLaXQgTG9nZ2VyIHVzZWQgdGhyb3VnaCB0aGUgQ0xJLiAqL1xuICBjb25zdCBsb2dnZXIgPSBjcmVhdGVDb25zb2xlTG9nZ2VyKGFyZ3ZbJ3ZlcmJvc2UnXSk7XG5cbiAgLy8gQ2hlY2sgdGhlIHRhcmdldC5cbiAgY29uc3QgdGFyZ2V0U3RyID0gYXJndi5fWzBdIHx8ICcnO1xuICBpZiAoIXRhcmdldFN0ciB8fCBhcmd2LmhlbHApIHtcbiAgICAvLyBTaG93IGFyY2hpdGVjdCB1c2FnZSBpZiB0aGVyZSdzIG5vIHRhcmdldC5cbiAgICB1c2FnZShsb2dnZXIpO1xuICB9XG5cbiAgLy8gTG9hZCB3b3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlLlxuICBjb25zdCBjdXJyZW50UGF0aCA9IHByb2Nlc3MuY3dkKCk7XG4gIGNvbnN0IGNvbmZpZ0ZpbGVOYW1lcyA9IFtcbiAgICAnYW5ndWxhci5qc29uJyxcbiAgICAnLmFuZ3VsYXIuanNvbicsXG4gICAgJ3dvcmtzcGFjZS5qc29uJyxcbiAgICAnLndvcmtzcGFjZS5qc29uJyxcbiAgXTtcblxuICBjb25zdCBjb25maWdGaWxlUGF0aCA9IGZpbmRVcChjb25maWdGaWxlTmFtZXMsIGN1cnJlbnRQYXRoKTtcblxuICBpZiAoIWNvbmZpZ0ZpbGVQYXRoKSB7XG4gICAgbG9nZ2VyLmZhdGFsKGBXb3Jrc3BhY2UgY29uZmlndXJhdGlvbiBmaWxlICgke2NvbmZpZ0ZpbGVOYW1lcy5qb2luKCcsICcpfSkgY2Fubm90IGJlIGZvdW5kIGluIGBcbiAgICAgICsgYCcke2N1cnJlbnRQYXRofScgb3IgaW4gcGFyZW50IGRpcmVjdG9yaWVzLmApO1xuXG4gICAgcmV0dXJuIDM7XG4gIH1cblxuICBjb25zdCByb290ID0gcGF0aC5kaXJuYW1lKGNvbmZpZ0ZpbGVQYXRoKTtcbiAgY29uc3QgY29uZmlnQ29udGVudCA9IHJlYWRGaWxlU3luYyhjb25maWdGaWxlUGF0aCwgJ3V0Zi04Jyk7XG4gIGNvbnN0IHdvcmtzcGFjZUpzb24gPSBKU09OLnBhcnNlKGNvbmZpZ0NvbnRlbnQpO1xuXG4gIGNvbnN0IHJlZ2lzdHJ5ID0gbmV3IHNjaGVtYS5Db3JlU2NoZW1hUmVnaXN0cnkoKTtcbiAgcmVnaXN0cnkuYWRkUG9zdFRyYW5zZm9ybShzY2hlbWEudHJhbnNmb3Jtcy5hZGRVbmRlZmluZWREZWZhdWx0cyk7XG5cbiAgY29uc3QgaG9zdCA9IG5ldyBOb2RlSnNTeW5jSG9zdCgpO1xuICBjb25zdCB3b3Jrc3BhY2UgPSBuZXcgZXhwZXJpbWVudGFsLndvcmtzcGFjZS5Xb3Jrc3BhY2Uobm9ybWFsaXplKHJvb3QpLCBob3N0KTtcblxuICBhd2FpdCB3b3Jrc3BhY2UubG9hZFdvcmtzcGFjZUZyb21Kc29uKHdvcmtzcGFjZUpzb24pLnRvUHJvbWlzZSgpO1xuXG4gIC8vIENsZWFyIHRoZSBjb25zb2xlLlxuICBwcm9jZXNzLnN0ZG91dC53cml0ZSgnXFx1MDAxQmMnKTtcblxuICByZXR1cm4gYXdhaXQgX2V4ZWN1dGVUYXJnZXQobG9nZ2VyLCB3b3Jrc3BhY2UsIHJvb3QsIGFyZ3YsIHJlZ2lzdHJ5KTtcbn1cblxubWFpbihwcm9jZXNzLmFyZ3Yuc2xpY2UoMikpXG4gIC50aGVuKGNvZGUgPT4ge1xuICAgIHByb2Nlc3MuZXhpdChjb2RlKTtcbiAgfSwgZXJyID0+IHtcbiAgICBjb25zb2xlLmVycm9yKCdFcnJvcjogJyArIGVyci5zdGFjayB8fCBlcnIubWVzc2FnZSB8fCBlcnIpO1xuICAgIHByb2Nlc3MuZXhpdCgtMSk7XG4gIH0pO1xuIl19