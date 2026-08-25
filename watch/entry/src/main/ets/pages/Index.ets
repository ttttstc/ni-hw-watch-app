import { DEFAULT_BRIDGE_URL, DEV_BRIDGE_TOKEN } from '../config/AppConfig';
import { CodexSnapshot, emptySnapshot } from '../model/CodexState';
import { LanBridgeClient } from '../service/LanBridgeClient';

@Entry
@Component
struct Index {
  private client: LanBridgeClient = new LanBridgeClient();

  @State connected: boolean = false;
  @State snapshot: CodexSnapshot = emptySnapshot();
  @State errorMessage: string = '';

  aboutToAppear(): void {
    this.client.onConnectionChanged = (connected: boolean) => {
      this.connected = connected;
    };
    this.client.onSnapshot = (snapshot: CodexSnapshot) => {
      this.snapshot = snapshot;
      this.errorMessage = '';
    };
    this.client.onError = (message: string) => {
      this.errorMessage = message;
    };
    this.client.connect(DEFAULT_BRIDGE_URL, DEV_BRIDGE_TOKEN);
  }

  aboutToDisappear(): void {
    this.client.disconnect();
  }

  private gauge(value: number | null): number {
    return value === null ? 0 : value;
  }

  private statusText(): string {
    switch (this.snapshot.status) {
      case 'ready':
        return 'READY';
      case 'working':
        return 'WORKING';
      case 'waiting_input':
        return 'WAITING INPUT';
      case 'done':
        return 'TASK DONE';
      case 'error':
        return 'ERROR';
      default:
        return 'OFFLINE';
    }
  }

  private statusColor(): string {
    switch (this.snapshot.status) {
      case 'ready':
      case 'working':
      case 'done':
        return '#7DFF54';
      case 'waiting_input':
        return '#FFD45B';
      case 'error':
        return '#FF5F64';
      default:
        return '#8A93A8';
    }
  }

  private tokenText(): string {
    const tokens = this.snapshot.gauges.tokensUsed;
    if (tokens === null) {
      return '--';
    }
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`;
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`;
    }
    return `${tokens}`;
  }

  @Builder
  private metric(label: string, value: string) {
    Row() {
      Text(label)
        .fontSize(12)
        .fontColor('#7B89A8')
      Text(value)
        .fontSize(15)
        .fontWeight(FontWeight.Bold)
        .fontColor('#E8EEFF')
    }
    .width('100%')
    .justifyContent(FlexAlign.SpaceBetween)
  }

  build() {
    Column() {
      Row() {
        Circle({ width: 7, height: 7 })
          .fill(this.connected ? '#66F0C2' : '#7A8190')
        Text(this.connected ? 'LAN CONNECTED' : 'LAN OFFLINE')
          .fontSize(10)
          .fontColor(this.connected ? '#66F0C2' : '#7A8190')
          .margin({ left: 6 })
      }
      .margin({ top: 12, bottom: 4 })

      Stack({ alignContent: Alignment.Center }) {
        Progress({ value: this.gauge(this.snapshot.gauges.weeklyRemainingPercent), total: 100, type: ProgressType.Ring })
          .width(280)
          .height(280)
          .color('#2F67FF')
          .backgroundColor('#111B36')

        Progress({ value: this.gauge(this.snapshot.gauges.fiveHourRemainingPercent), total: 100, type: ProgressType.Ring })
          .width(228)
          .height(228)
          .color('#62A8FF')
          .backgroundColor('#10233D')

        Progress({ value: this.gauge(this.snapshot.gauges.contextRemainingPercent), total: 100, type: ProgressType.Ring })
          .width(176)
          .height(176)
          .color('#62E6BD')
          .backgroundColor('#12332E')

        Column() {
          Text(this.snapshot.model)
            .fontSize(15)
            .fontWeight(FontWeight.Medium)
            .fontColor('#F2F5FF')
            .maxLines(1)
          Text(this.statusText())
            .fontSize(this.snapshot.status === 'waiting_input' ? 15 : 18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.statusColor())
            .margin({ top: 3 })
            .maxLines(1)
        }
        .width(130)
        .alignItems(HorizontalAlign.Center)
      }
      .width('100%')
      .height(292)

      Column({ space: 3 }) {
        this.metric('CTX', this.snapshot.gauges.contextRemainingPercent === null ? '--' : `${this.snapshot.gauges.contextRemainingPercent}%`)
        this.metric('5H', this.snapshot.gauges.fiveHourRemainingPercent === null ? '--' : `${this.snapshot.gauges.fiveHourRemainingPercent}%`)
        this.metric('WK', this.snapshot.gauges.weeklyRemainingPercent === null ? '--' : `${this.snapshot.gauges.weeklyRemainingPercent}%`)
        this.metric('TOK', this.tokenText())
      }
      .width('68%')

      if (this.snapshot.task.promptPreview !== null && this.snapshot.task.promptPreview.length > 0) {
        Text(this.snapshot.task.promptPreview)
          .fontSize(11)
          .fontColor('#B7C0D8')
          .maxLines(2)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .textAlign(TextAlign.Center)
          .width('76%')
          .margin({ top: 8 })
      }

      if (this.errorMessage.length > 0 && !this.connected) {
        Text('Tap to retry')
          .fontSize(11)
          .fontColor('#FF9E9E')
          .margin({ top: 8 })
          .onClick(() => {
            this.client.connect(DEFAULT_BRIDGE_URL, DEV_BRIDGE_TOKEN);
          })
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor('#05070C')
    .alignItems(HorizontalAlign.Center)
  }
}
