# HOW TO RUN THIS IN CLASS

1. Before class, open PowerPoint, [presenter access](https://rebuild-riverton-e6396948.azurewebsites.net/control), and the [offline backup](https://rebuild-riverton-e6396948.azurewebsites.net/offline). Rehearse once shortly before class to warm the Azure app. On the offline controls, open its projector once while connected so the backup assets load. Keep both backup tabs open.
2. In `/control`, press **Create class session**. Use **Save private recovery link** to save the presenter link somewhere private. Keep the controls on your laptop. Never display the recovery link to students.
3. Press **Open projector**. Move that tab to the projector and use browser full screen. The projector follows your controls automatically. Start on its QR lobby; this is the transition from PowerPoint slide 5.
4. Ask students to scan the QR code. Alternatively, they visit the base address and enter the class code. Names and emails are not requested. Reloading in the same browser preserves their seat and locked decisions.
5. Watch **Connected** and **Joined**. Joined includes everyone who entered; connected means seen in the last two minutes. Open **Introduce Riverton**, then **Open round 1**. Briefly explain the committee’s mission.
6. Watch **Decisions submitted**. When enough of the class has answered, press **Close voting**, then **Reveal results**. You can reveal without every student. Pause for the discussion question.
7. Press **Next round**, then **Open round** when the room is ready. Repeat for the five decisions. Round 3 requires exactly two commitments. The funding budget always totals $8 million.
8. After round 5, press **Show class profile**, **Compare to real world**, **Reveal Method / Pullman**, **Reveal Menomonee Valley**, then **Show class comparison**. Strategy profiles are interpretations of fictional choices, not grades. Case comparison levels are illustrative teaching judgments.
9. Press **Open final poll**. When enough students have responded, press **Reveal final poll**. The poll does not change their strategy. Discuss “Legal does not automatically mean ethical.”
10. Press **End session** and confirm. The projector keeps a complete final discussion screen. Switch back to PowerPoint using Command-Tab on Mac or Alt-Tab on Windows.
11. If a few phones disconnect, ask students to keep the page open. Polling resumes when connectivity returns. If the backend works but participation fails, open **Emergency & reset options → Load demo results** and confirm. This adds 30 sample participants without changing real decisions. Tell the class you are using sample data; the projector itself does not label it. If the backend or internet is unavailable, use the already-loaded `/offline` controls and its `/live/OFFLINE` projector. This backup starts at the introduction, uses sample results, and does not accept phone responses. You can also run the local app on your laptop; internet access is unnecessary for its backend.

Suggested pacing for 5–10 minutes: lobby/introduction 45 seconds; each round 45–60 seconds; profile/cases 90 seconds; final poll/discussion 60 seconds. Students can read the detailed scenarios while you introduce each decision. Skip extended discussion if time is tight.

# HOW TO REHEARSE IT

1. Open the [live demo](https://rebuild-riverton-e6396948.azurewebsites.net/demo), or start the local application using `npm run dev` from the project folder and open `http://localhost:5173/demo`.
2. Press **Run demo class**. Thirty simulated participants are added automatically.
3. Open its projector in a second tab. Use the same controls and reveal sequence as in class. Sample answers populate when each round opens.
4. To practice the student experience too, open `/join/<code>` in a private browser window or on another device connected to your laptop’s network. Use the network address printed by Vite. Your laptop must allow incoming connections on port 5173. The student counts as an additional participant.
5. Rehearse the full PowerPoint-to-browser transition. Verify the QR code is readable and the final screen is a natural point to return to your slides.
6. Rehearse `/offline` separately and use **Reset session** to restart. Live session reset preserves participant seats, clears answers, and invalidates old pending submissions. Sessions expire after 24 hours; create a fresh class on presentation day.

Keep the offline tabs in the same browser profile. The backup communicates through browser-local storage. Offline caching is available in production builds after the service worker finishes caching; developer mode requires the local server to remain running. Do not close the laptop server during local rehearsal.
