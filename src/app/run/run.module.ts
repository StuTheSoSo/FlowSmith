import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { RunPageRoutingModule } from './run-routing.module';
import { RunPage } from './run.page';

@NgModule({
  imports: [CommonModule, IonicModule, RunPageRoutingModule, TranslatePipe],
  declarations: [RunPage],
})
export class RunPageModule {}
