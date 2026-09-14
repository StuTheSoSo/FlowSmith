import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { OnboardingPage } from './onboarding.page';
import { OnboardingPageRoutingModule } from './onboarding-routing.module';

@NgModule({
  imports: [CommonModule, IonicModule, OnboardingPageRoutingModule, TranslatePipe],
  declarations: [OnboardingPage],
})
export class OnboardingPageModule {}
