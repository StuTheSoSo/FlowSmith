import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { TemplatesPage } from './templates.page';
import { TemplatesPageRoutingModule } from './templates-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, TemplatesPageRoutingModule, TranslatePipe],
  declarations: [TemplatesPage],
})
export class TemplatesPageModule {}
