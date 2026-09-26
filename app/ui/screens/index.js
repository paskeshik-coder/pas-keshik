/**
 * Registry of every screen by name (the names used with ctx.nav.push/reset).
 */

import { intro } from './intro.js?v=0.6.1';
import { signupName, signupMajor, signupUniversity, signupRules, signupBot } from './signup.js?v=0.6.1';
import { board } from './board.js?v=0.6.1';
import { newRequest, newRequestEnd, newRequestPrice, reviewRequest } from './new-request.js?v=0.6.1';
import { myRequests } from './my-requests.js?v=0.6.1';
import { myOffers } from './my-offers.js?v=0.6.1';
import { offerForm } from './offer-form.js?v=0.6.1';
import { invite } from './invite.js?v=0.6.1';
import { contact } from './contact.js?v=0.6.1';
import { settings } from './settings.js?v=0.6.1';
import { banned } from './banned.js?v=0.6.1';
import { request } from './request.js?v=0.6.1';

export const SCREENS = {
  intro,
  signupName,
  signupMajor,
  signupUniversity,
  signupRules,
  signupBot,
  board,
  newRequest,
  newRequestEnd,
  newRequestPrice,
  reviewRequest,
  myRequests,
  myOffers,
  offerForm,
  invite,
  contact,
  settings,
  banned,
  request,
};
