import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TemplatesPage } from './templates.page';
import { TemplatesPageRoutingModule } from './templates-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, TemplatesPageRoutingModule],
  declarations: [TemplatesPage],
})
export class TemplatesPageModule {}
