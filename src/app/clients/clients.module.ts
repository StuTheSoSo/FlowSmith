import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { ClientsPage } from './clients.page';
import { ClientsPageRoutingModule } from './clients-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, ClientsPageRoutingModule],
  declarations: [ClientsPage],
})
export class ClientsPageModule {}
