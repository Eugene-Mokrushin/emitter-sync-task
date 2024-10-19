/* Check the comments first */

import { EventEmitter } from "./emitter";
import { EventDelayedRepository } from "./event-repository";
import { EventStatistics } from "./event-statistics";
import { ResultsTester } from "./results-tester";
import { triggerRandomly } from "./utils";

const MAX_EVENTS = 1000;

enum EventName {
  EventA = "A",
  EventB = "B",
}

const EVENT_NAMES = [EventName.EventA, EventName.EventB];

/*

  An initial configuration for this case

*/

function init() {
  const emitter = new EventEmitter<EventName>();

  triggerRandomly(() => emitter.emit(EventName.EventA), MAX_EVENTS);
  triggerRandomly(() => emitter.emit(EventName.EventB), MAX_EVENTS);

  const repository = new EventRepository();
  const handler = new EventHandler(emitter, repository);

  const resultsTester = new ResultsTester({
    eventNames: EVENT_NAMES,
    emitter,
    handler,
    repository,
  });
  resultsTester.showStats(20);
}

/* Please do not change the code above this line */
/* ----–––––––––––––––––––––––––––––––––––––---- */

/*

  The implementation of EventHandler and EventRepository is up to you.
  Main idea is to subscribe to EventEmitter, save it in local stats
  along with syncing with EventRepository.

*/


/*
  ----EXPLANATION----

  Logic that I was pursuing was to create an internal clock that would take a snapshot every 500ms and save the snapshot in the repo.
  Later I would compare the snapshot with the current stats and save the difference in the repo. This way I would avoid saving the same data multiple times.
  I would also retry saving the data if it failed. I would retry 3 times with a delay of 150ms between each retry.
  If it failed all 3 times, I would give up and not save the data.
  Life would be much easier if there was a function updateMultipleEventStatsBy or event updateMultipleEvents that would take an array of events and their counts and update them in the repo.
*/

class EventHandler extends EventStatistics<EventName> {
  repository: EventRepository;
  private lastCheckTime: number = 0;
  private checkInterval: number = 500;

  constructor(emitter: EventEmitter<EventName>, repository: EventRepository) {
    super();
    this.repository = repository;

    emitter.subscribe(EventName.EventA, () =>
      this.handleEvent(EventName.EventA)
    );
    emitter.subscribe(EventName.EventB, () =>
      this.handleEvent(EventName.EventB)
    );

    this.startPeriodicCheck();
  }

  private handleEvent(eventName: EventName) {
    const currentCount = this.getStats(eventName);
    const toUpdate = currentCount + 1;
    this.setStats(eventName, toUpdate);
  }

  private startPeriodicCheck() {
    setInterval(async () => {
      const now = Date.now();
      if (now >= this.lastCheckTime + this.checkInterval) {
        await this.saveEventData();
        this.lastCheckTime = now;
      }
    }, this.checkInterval);
  }

  private async saveEventData() {
    const eventNames = [EventName.EventA, EventName.EventB];
    for (const eventName of eventNames) {
      const currentCount = this.getStats(eventName);
      if (currentCount > 0) {
        await this.repository.saveEventData(eventName, currentCount);
      }
    }
  }
}

class EventRepository extends EventDelayedRepository<EventName> {
  private maxRetries = 3;
  private retryDelay = 150;

  async saveEventData(eventName: EventName, count: number) {
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.updateEventStatsBy(
          eventName,
          count - this.getStats(eventName)
        );
        return;
      } catch (e) {
        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay);
        }
      }
    }
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

init();
