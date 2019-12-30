import { Component, CUSTOM_ELEMENTS_SCHEMA, ViewChild } from '@angular/core';
import { AppService } from './app.service';
import { LoadingSpinnerService } from './loading-spinner.service';
import { StatusBarService } from './status-bar.service';
import { WebviewService } from './webview.service';
import { DragAndDropService } from './drag-and-drop.service';
import { ElectronService } from './electron.service';
import { BsaberService } from './bsaber.service';
import { AdbClientService } from './adb-client.service';
import { BeatOnService } from './beat-on.service';
@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.css'],
})
export class AppComponent {
    @ViewChild('spinner', { static: false }) spinner;
    @ViewChild('status', { static: false }) status;
    @ViewChild('webview', { static: false }) webview;
    constructor(
        private spinnerService: LoadingSpinnerService,
        private statusService: StatusBarService,
        private adbService: AdbClientService,
        private appService: AppService,
        public webService: WebviewService,
        public dragService: DragAndDropService,
        electronService: ElectronService,
        private bsaberSerivce: BsaberService,
        private beatonService: BeatOnService
    ) {
        this.appService.hideNSFW = !!localStorage.getItem('hideNSFW');
    }
    ngOnInit() {
        this.adbService
            .setupAdb()
            // .then(() => this.bsaberSerivce.downloadQSP())
            // .then(() => this.adbService.setupAdb())
            .then(() => this.adbService.connectedStatus())
            .then(() => this.bsaberSerivce.getMySongs())
            .then(() => (this.bsaberSerivce.jSon = this.bsaberSerivce.getAppJson()))
            .then(() => {
                if (!localStorage.getItem('first_run')) {
                    localStorage.setItem('first_run', 'true');
                    this.statusService.showStatus(
                        'Thanks for downloading SideQuest! Please click "Setup" on the top menu to begin and then "Sign Up" to get app updates, remote installing and more!'
                    );
                }

                this.dragService.setupDragAndDrop(this.webview.nativeElement);
            });
    }
    ngAfterViewInit() {
        this.spinnerService.setSpinner(this.spinner);
        this.statusService.setStatus(this.status);
        this.webService.setWebView(this.webview.nativeElement);
    }
}
