import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { LibraryPage } from './library.page';
import { LibraryPageRoutingModule } from './library-routing.module';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, LibraryPageRoutingModule, TranslatePipe],
  declarations: [LibraryPage],
})
export class LibraryPageModule {}
