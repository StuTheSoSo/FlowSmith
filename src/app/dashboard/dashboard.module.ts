import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { DashboardPage } from './dashboard.page';
import { ArticlePage } from './article.page';

@NgModule({
  declarations: [DashboardPage, ArticlePage],
  imports: [CommonModule, IonicModule, TranslatePipe, RouterModule.forChild([
    { path: 'read/:slug', component: ArticlePage },
    { path: '', pathMatch: 'full', component: DashboardPage },
  ])],
})
export class DashboardModule {}