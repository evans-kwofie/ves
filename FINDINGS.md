The following are some outstandings that need to be ironed out before we can go live:

## Reddit & Instagram Outreach

Reddit and Instagram are both good sources of good-intent leads. The system needs to be updated to allow outreach into those sources as well. Reddit for instance is one of the few places where your leads may be talking about their problem while Instagram is the place to have a more direct personalised engagement without the salesy vibe of LinkedIn. Also a lot of outreach teams use Instagram a lot.

when creating the campaign i choose only linkedin so when i generate the drafts and later mark them as sent i expect it to have  
linkedinsentat set to the currenttimestamp instead it rather updated the email sent at and the status was set to email sent instead of  
linkedin...email is one of many channels not the default channel. also some of them are coming back with repliedat being truthy i dont  
even know how that is possible because even if we sent via email-which we didnt-we havent received any replies back so how did the data  
come back saying we have received replies? in terms of the database schema for this particular table we now have reddit, instagram, email
and linkedin as channels..are we simply going to have linkedinsentat,emailsentat, redditsentat and co? that seems like such a poor  
database design...
