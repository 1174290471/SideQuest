import { Injectable } from '@angular/core';
import { StatusBarService } from './status-bar.service';
export interface ProcessTask {
    key: string;
    name: string;
    icon: string;
    status?: string;
    running?: boolean;
    percent?: string;
    failed?: boolean;
    succeeded?: boolean;
    resolve: (task: ProcessTask) => Promise<void>;
}
@Injectable({
    providedIn: 'root',
})
export class ProcessBucketService {
    tasks: ProcessTask[];
    is_running: boolean;
    constructor(private statusService: StatusBarService) {
        this.tasks = [];
        this.processBucket();
    }

    addItem(name, resolve) {
        const key = (<any>window).require('uuid/v4')();
        const status = 'Waiting...';
        let icon = 'list';
        let _name = 'app install';
        switch (name) {
            case 'song_download':
                icon = 'library_music';
                _name = 'song download';
                break;
            case 'file_install':
                _name = 'file install';
                icon = 'cloud_download';
                break;
            case 'apk_install':
                icon = 'cloud_download';
                _name = 'app install';
                break;
            case 'apk_uninstall':
                icon = 'remove_circle_outline';
                _name = 'app uninstall';
                break;
            case 'backup_package':
                icon = 'move_to_inbox';
                _name = 'app backup';
                break;
            case 'save_files':
                icon = 'archive';
                _name = 'app data backup';
                break;
            case 'restore_files':
                icon = 'unarchive';
                _name = 'app data restore';
                break;
        }
        if (!this.tasks.length) {
            this.statusService.showStatus('Starting ' + _name + '...');
        }
        this.tasks.push({
            key,
            name,
            icon,
            status,
            resolve,
        });
    }

    async processBucket() {
        const objects = this.tasks.filter(t => t.status === 'Waiting...');
        const timeout = new Promise(resolve => setTimeout(() => resolve(), 500));
        if (objects.length) {
            this.is_running = true;
            let task = objects[0];
            task.running = true;
            await task
                .resolve(task)
                .then(() => {
                    task.succeeded = true;
                    return timeout.then(() => this.processBucket());
                })
                .catch(e => {
                    task.running = false;
                    task.status = e.message ? e.message : e.code ? e.code : e.toString();
                    task.failed = true;
                    this.statusService.showStatus(task.status, true);
                    return timeout.then(() => this.processBucket());
                });
            this.tasks = this.tasks.filter(t => t !== task);
        } else {
            let hasFailed = !!this.tasks.filter(t => t.failed).length;
            if (this.is_running) {
                this.statusService.showStatus(
                    (hasFailed ? 'Some tasks failed. ' : 'All tasks completed! ') + 'See the tasks screen for more info.',
                    hasFailed
                );
            }
            this.is_running = false;
            await timeout.then(() => this.processBucket());
        }
    }

    retryFailed() {
        this.tasks.forEach(t => {
            if (t.failed) {
                t.status = 'Waiting...';
                t.failed = false;
            }
        });
    }

    clearDone() {
        this.tasks = this.tasks.filter(t => !t.succeeded);
    }

    clearFailed() {
        this.tasks = this.tasks.filter(t => !t.failed);
    }
}
