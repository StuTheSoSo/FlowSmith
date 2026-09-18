import { AfterViewInit, Directive, ElementRef, Input, OnChanges, OnDestroy } from '@angular/core';

@Directive({ selector: '[appFitText]', standalone: true })
export class FitTextDirective implements AfterViewInit, OnChanges, OnDestroy {
  @Input() appFitText = '';
  @Input() fitTextMax = 160;
  private observer?: ResizeObserver;
  private frame = 0;

  constructor(private readonly element: ElementRef<HTMLElement>) {}

  ngAfterViewInit(): void {
    this.observer = new ResizeObserver(() => this.scheduleFit());
    this.observer.observe(this.element.nativeElement.parentElement!);
    void document.fonts.ready.then(() => {
      if (this.observer) this.scheduleFit();
    });
    this.scheduleFit();
  }

  ngOnChanges(): void {
    this.scheduleFit();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = undefined;
    cancelAnimationFrame(this.frame);
  }

  private scheduleFit(): void {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const text = this.element.nativeElement;
      const container = text.parentElement;
      if (!container?.clientWidth || !container.clientHeight) return;
      let minimum = 8;
      let maximum = this.fitTextMax;
      while (maximum - minimum > 1) {
        const size = Math.floor((minimum + maximum) / 2);
        text.style.fontSize = `${size}px`;
        if (text.scrollWidth <= container.clientWidth && text.scrollHeight <= container.clientHeight) {
          minimum = size;
        } else {
          maximum = size;
        }
      }
      text.style.fontSize = `${minimum}px`;
    });
  }
}