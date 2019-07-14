import { Component, OnInit, ViewChild } from '@angular/core';
import { AdbClientService, ConnectionStatus } from '../adb-client.service';
import { AppService } from '../app.service';
import { LoadingSpinnerService } from '../loading-spinner.service';
import { StatusBarService } from '../status-bar.service';
interface FileFolderListing {
    name: string;
    icon: string;
    size: number;
    time: Date;
}
interface BreadcrumbListing {
    name: string;
    path: string;
}
declare let M;
@Component({
    selector: 'app-files',
    templateUrl: './files.component.html',
    styleUrls: ['./files.component.css'],
})
export class FilesComponent implements OnInit {
    @ViewChild('filesModal', { static: false }) filesModal;
    @ViewChild('fixedAction', { static: false }) fixedAction;
    files: FileFolderListing[] = [];
    currentFileDelete: FileFolderListing;
    breadcrumbs: BreadcrumbListing[] = [];
    isOpen: boolean = false;
    currentPath: string;
    folderName: string;
    confirmMessage: string;
    currentFile: FileFolderListing;
    constructor(
        public spinnerService: LoadingSpinnerService,
        public adbService: AdbClientService,
        public appService: AppService,
        public statusService: StatusBarService
    ) {
        this.appService.resetTop();
        appService.filesComponent = this;
        appService.isFilesOpen = true;
        appService.webService.isWebviewOpen = false;
    }
    ngOnAfterViewInit() {
        M.FloatingActionButton.init(this.fixedAction.nativeElement, {});
    }
    ngOnInit() {
        this.appService.setTitle('Headset Files');
    }
    makeFolder() {
        if (
            ~this.files
                .filter(f => f.icon === 'folder')
                .map(f => f.name)
                .indexOf(this.folderName)
        ) {
            return this.statusService.showStatus('A folder already exists with that name!!', true);
        } else {
            this.adbService.makeDirectory(this.appService.path.posix.join(this.currentPath, this.folderName)).then(r => {
                this.folderName = '';
                this.open(this.currentPath);
            });
        }
    }
    uploadFile(files): Promise<any> {
        if (!files.length) return Promise.resolve();
        let f = files.shift();
        let savePath = this.appService.path.posix.join(this.currentPath, this.appService.path.basename(f));
        return this.adbService
            .adbCommand('push', { serial: this.adbService.deviceSerial, path: f, savePath }, stats => {
                this.spinnerService.setMessage(
                    'File uploading: ' +
                        this.appService.path.basename(f) +
                        ' ' +
                        Math.round((stats.bytesTransferred / 1024 / 1024) * 100) / 100 +
                        'MB'
                );
            })
            .then(() => setTimeout(() => this.uploadFile(files), 500));
    }
    uploadFilesFromList(files: string[]) {
        if (files !== undefined && files.length) {
            this.spinnerService.showLoader();
            this.uploadFile(files)
                .then(() => {
                    this.spinnerService.setMessage('Files Uploaded!!');
                    setTimeout(() => {
                        this.open(this.currentPath);
                        this.spinnerService.hideLoader();
                        this.statusService.showStatus('Files Uploaded!!');
                    }, 500);
                })
                .catch(e => this.statusService.showStatus(e.toString(), true));
        }
    }
    uploadFiles() {
        this.appService.electron.remote.dialog.showOpenDialog(
            {
                properties: ['openFile', 'multiSelections'],
                defaultPath: this.adbService.savePath,
            },
            files => this.uploadFilesFromList(files)
        );
    }
    confirmDeleteFile(file: FileFolderListing) {
        let path = this.appService.path.posix.join(this.currentPath, file.name);
        this.confirmMessage = 'Are you sure you want to delete this item? - ' + path;
    }
    deleteFile(file: FileFolderListing) {
        let path = this.appService.path.posix.join(this.currentPath, file.name);
        this.adbService.adbCommand('shell', { serial: this.adbService.deviceSerial, command: 'rm "' + path + '" -r' }).then(r => {
            console.log(r);
            this.open(this.currentPath);
            this.statusService.showStatus('Item Deleted!! ' + path);
        });
    }
    saveFile() {
        this.filesModal.closeModal();
        let savePath = this.appService.path.join(this.adbService.savePath, this.currentFile.name);
        let path = this.appService.path.posix.join(this.currentPath, this.currentFile.name);
        this.spinnerService.showLoader();
        return this.adbService
            .adbCommand('pull', { serial: this.adbService.deviceSerial, path, savePath }, stats => {
                this.spinnerService.setMessage(
                    'File downloading: ' +
                        this.appService.path.basename(savePath) +
                        '<br>' +
                        Math.round(stats.bytesTransferred / 1024 / 1024) +
                        'MB'
                );
            })
            .then(() => {
                this.spinnerService.hideLoader();
                this.statusService.showStatus('Files Saved to ' + savePath + '!!');
            })
            .catch(e => this.statusService.showStatus(e.toString(), true));
    }
    pickLocation() {
        this.appService.electron.remote.dialog.showOpenDialog(
            {
                properties: ['openDirectory'],
                defaultPath: this.adbService.savePath,
            },
            files => {
                if (files !== undefined && files.length === 1) {
                    this.adbService.savePath = files[0];
                    this.adbService.setSavePath();
                }
            }
        );
    }
    isConnected() {
        let isConnected = this.adbService.deviceStatus === ConnectionStatus.CONNECTED;
        if (isConnected && !this.isOpen) {
            this.isOpen = true;
            this.open('/sdcard/');
        }
        return isConnected;
    }
    getCrumb(path: string) {
        let parts = path.split('/');
        let name = parts.pop();
        let parentPath = parts.join('/');
        if (parts.length > 0) {
            this.getCrumb(parentPath);
        }
        this.breadcrumbs.push({ path, name });
    }
    openFile(file: FileFolderListing) {
        if (file.icon === 'folder') {
            this.open(this.appService.path.posix.join(this.currentPath, file.name));
        } else {
            this.currentFile = file;
            this.filesModal.openModal();
        }
    }
    open(path: string) {
        this.spinnerService.showLoader();
        this.spinnerService.setMessage('Loading files...');
        this.currentPath = path;
        this.breadcrumbs = [];
        this.getCrumb(
            this.currentPath
                .split('/')
                .filter(d => d)
                .join('/')
        );
        if (!this.isConnected()) {
            return Promise.resolve();
        }
        return (
            this.adbService
                .adbCommand('readdir', { serial: this.adbService.deviceSerial, path })
                //this.adbService.client.readdir(this.adbService.deviceSerial, path)
                .then(files => {
                    this.files = files.map(file => {
                        let name = file.name;
                        let size = Math.round((file.size / 1024 / 1024) * 100) / 100;
                        let time = file.mtime;
                        let icon = 'folder';
                        if (file.__isFile) {
                            let fileParts = file.name.split('.');
                            let extension = (fileParts[fileParts.length - 1] || '').toLowerCase();
                            switch (extension) {
                                case 'gif':
                                case 'png':
                                case 'jpeg':
                                case 'jpg':
                                    icon = 'photo';
                                    break;
                                case 'wav':
                                case 'ogg':
                                case 'mp3':
                                    icon = 'music_note';
                                    break;
                                case 'avi':
                                case 'mp4':
                                    icon = 'ondemand_video';
                                    break;
                                case 'txt':
                                case 'docx':
                                case 'doc':
                                    icon = 'receipt';
                                    break;
                                case 'pptx':
                                case 'ppt':
                                    icon = 'picture_in_picture';
                                    break;
                                case 'xlsx':
                                case 'xls':
                                    icon = 'grid_on';
                                    break;
                                default:
                                    icon = 'receipt';
                                    break;
                            }
                        }
                        return { name, icon, size, time };
                    });
                    this.files.sort(function(a, b) {
                        let textA = a.name.toUpperCase();
                        let textB = b.name.toUpperCase();
                        return textA < textB ? -1 : textA > textB ? 1 : 0;
                    });
                    this.files = this.files.filter(d => d.icon === 'folder').concat(this.files.filter(d => d.icon !== 'folder'));

                    this.spinnerService.hideLoader();
                })
        );
    }
}
