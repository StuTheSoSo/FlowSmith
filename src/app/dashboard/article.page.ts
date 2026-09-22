import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { FlowDataService } from '../flow-data.service';
import { ARTICLES, FURTHER_RESOURCES } from './dashboard-content';

@Component({
  selector: 'app-article',
  templateUrl: './article.page.html',
  styleUrls: ['./article.page.scss'],
  standalone: false,
})
export class ArticlePage implements OnInit, OnDestroy {
  article: typeof ARTICLES[number] | undefined;
  readonly sections = ['ONE', 'TWO', 'THREE'];
  readonly resources = FURTHER_RESOURCES;
  private routeSubscription?: Subscription;

  constructor(private readonly route: ActivatedRoute, private readonly router: Router, readonly flowData: FlowDataService) {}

  ngOnInit(): void {
    this.routeSubscription = this.route.paramMap.subscribe(params => {
      this.article = ARTICLES.find(article => article.slug === params.get('slug'));
      if (!this.article) void this.router.navigateByUrl('/home', { replaceUrl: true });
    });
  }

  ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); }
}