import {LitElementI18n} from '../i18n';
import i18next from 'i18next';
import {html} from 'lit-element';
import 'fomantic-ui-css/components/accordion.js';
import $ from '../jquery.js';

class NgmReviewWindow extends LitElementI18n {

  static get properties() {
    return {
      hideReviewWindow: {type: Boolean}
    };
  }

  firstUpdated() {
    $(this.querySelector('.accordion')).accordion({
      duration: 150,
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
