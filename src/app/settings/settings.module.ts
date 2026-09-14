import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { SettingsPage } from './settings.page';
import { SettingsPageRoutingModule } from './settings-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, SettingsPageRoutingModule, TranslatePipe],
  declarations: [SettingsPage],
})
export class SettingsPageModule {}
