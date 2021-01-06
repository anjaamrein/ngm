import {I18nMixin} from '../i18n';
import i18next from 'i18next';
import {LitElement, html} from 'lit-element';
import {accordion} from '../ui/accordion.js';

class NgmReviewWindow extends I18nMixin(LitElement) {

  static get properties() {
    return {
      hideReviewWindow: {type: Boolean}
    };
  }

  firstUpdated() {
    accordion(this.querySelector('.accordion'), {
      onChange: () => this.dispatchEvent(new CustomEvent('review_window_changed'))
    });
  }

  render() {
    return html`
      <div class="ui inverted segment">
        <div class="ui inverted accordion">
          <div class="title ${!this.hideReviewWindow ? 'active' : ''}">
            <i class="dropdown icon"></i>
            ${i18next.t('header_review_link')}
          </div>
          <div class="content ${!this.hideReviewWindow ? 'active' : ''}">
            <p>${i18next.t('review_window_text')}</p>
            <a href="https://findmind.ch/c/XmNb9jKz2w" target="_blank">${i18next.t('header_review_link')}</a>
          </div>
        </div>
      </div>
    `;
  }

  createRenderRoot() {
    return this;
  }
}

customElements.define('ngm-review-window', NgmReviewWindow);
