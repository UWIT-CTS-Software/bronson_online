import os
import sys
import json
import ast
import subprocess
import time
import re
import urllib.request
import urllib.parse
import datetime
import pytz # Required, needs to be installed seperately
from datetime import datetime, date
from datetime import timedelta
from pathlib import Path
from collections import defaultdict


# ---------------------------------- Helpers -----------------------------------
CTS_RESPONSIBILITY_GROUP_ID = 2742

# Finds the .env file
def findEnvFile():
    # 1. Try ./.env
    path1 = Path(".env").resolve()
    if path1.exists(): 
        return path1

    # 2. Try ../../.env
    path2 = (Path.cwd().parents[1] / ".env").resolve()
    if path2.exists():
        return path2

    # 3. Not found
    return None


# Helper function to check note string length
def noteLengthCheck(inputText):
    while True:
        note = input(inputText)
        note = note.strip()
        if (len(note) > 80):
            print("This note is too long, please shorten and try again.")
            continue
        elif (note == ""): 
            return "SKIP"
        else: 
            return note


# Helper function to collect notes with length check and max limit of notes
def collectNotes(max_notes=5):
    print(" - One line for every note")
    print(" - 80 characters max per note")
    print(" - Enter a blank line when done\n")

    notes = []
    for i in range(1, max_notes + 1):
        note = noteLengthCheck(f"Note {i}: ")
        if note == "SKIP": break
        notes.append(note)
    return notes


# Helper function to convert notes list to LaTeX itemize format
def notesToLatex(notes, title, font_size="large"):
    latex = r"""
        \begin{quote}
        \textbf{""" + title + r"""}
        \begin{itemize}
    """
    latex += f"\\{font_size}\n"
    for note in notes:
        latex += f"\\item {note}\n"
    latex += "\\end{itemize}\n\\end{quote}\n"

    return latex


# Helper to fill out table cells
def fillCells(date_string, period_string, tdxToken, lsm_period_url_postfix_this, lsm_period_url_postfix_last, report_ids=[]):
    # Report data
    tickets_created_this_period    = fetchTDXReport(report_ids[0], tdxToken)
    tickets_created_last_period    = fetchTDXReport(report_ids[1], tdxToken)
    tickets_closed_this_period     = fetchTDXReport(report_ids[2], tdxToken)
    tickets_closed_last_period     = fetchTDXReport(report_ids[3], tdxToken)
    tickets_false_this_period      = fetchTDXReport(report_ids[4], tdxToken)
    tickets_roomchecks_this_period = fetchTDXReport(report_ids[5], tdxToken)
    tickets_wyocast_this_period    = fetchTDXReport(report_ids[6], tdxToken)
    tickets_pc_this_period         = fetchTDXReport(report_ids[7], tdxToken)
    tickets_open_last_period       = tickets_currently_open - tickets_created_this_period + tickets_closed_this_period
    roomchecks_this_period         = fetchLSMReport(lsm_period_url_postfix_this)
    roomchecks_last_period         = fetchLSMReport(lsm_period_url_postfix_last)

    latex = latex_template % (
        date_string,
        # Tickets Created                             # Tickets Closed                             # Current Open Tickets                       # False Tickets
        tickets_created_this_period,                  tickets_closed_this_period,                  tickets_currently_open,                      tickets_false_this_period,
        period_string, tickets_created_last_period,   period_string, tickets_closed_last_period,   period_string, tickets_open_last_period, 
        # ---------------------------------------------------------------------------------------------------------------------------------
        # Room Checks Performed                       # Tickets from Room Checks                   # WyoCast / Event Tickets                    # PC Tickets
        roomchecks_this_period,                       tickets_roomchecks_this_period,              tickets_wyocast_this_period,                 tickets_pc_this_period,
        period_string, roomchecks_last_period,
    )

    return latex


# Helper to fill out table cells (for custom date range)
def fillCellsCustom(date_string, period_string, tdxToken, lsm_period_url_postfix_this, lsm_period_url_postfix_last, start_date, end_date, report_ids=[]):
    # Calculate previous time period
    date_delta = end_date - start_date
    last_end_date = start_date
    last_start_date = start_date - date_delta

    # Query TDX for custom range
    tickets_created_this_period    = len(fetchTDXSearch({
        "CreatedDateFrom": formatUTC(start_date),
        "CreatedDateTo": formatUTC(end_date, end_of_day=True),
        "ResponsibilityGroupIDs": [CTS_RESPONSIBILITY_GROUP_ID],
        "MaxResults": 100000,
    }, tdxToken))
    tickets_created_last_period    = len(fetchTDXSearch({
        "CreatedDateFrom": formatUTC(last_start_date),
        "CreatedDateTo": formatUTC(last_end_date, end_of_day=True),
        "ResponsibilityGroupIDs": [CTS_RESPONSIBILITY_GROUP_ID],
        "MaxResults": 100000,
    }, tdxToken))
    tickets_closed_this_period     = len(fetchTDXSearch({
        "ClosedDateFrom": formatUTC(start_date),
        "ClosedDateTo": formatUTC(end_date, end_of_day=True),
        "ResponsibilityGroupIDs": [CTS_RESPONSIBILITY_GROUP_ID],
        "MaxResults": 100000,
    }, tdxToken))
    tickets_closed_last_period     = len(fetchTDXSearch({
        "ClosedDateFrom": formatUTC(last_start_date),
        "ClosedDateTo": formatUTC(last_end_date, end_of_day=True),
        "ResponsibilityGroupIDs": [CTS_RESPONSIBILITY_GROUP_ID],
        "MaxResults": 100000,
    }, tdxToken))
    tickets_false_this_period      = len(fetchTDXSearch({
        "ParentTicketID": 22873142, # The TicketID that contains all the false tickets
        "CreatedDateFrom": formatUTC(start_date),
        "CreatedDateTo": formatUTC(end_date, end_of_day=True),
        "MaxResults": 100000,
    }, tdxToken))
    
    # This data can't be queried with custom date, so we round to the nearest week/month/year depending on the length of the custom date range
    tickets_wyocast_this_period    = fetchTDXReport(report_ids[0], tdxToken) 
    tickets_pc_this_period         = fetchTDXReport(report_ids[1], tdxToken)
    tickets_roomchecks_this_period = fetchTDXReport(report_ids[2], tdxToken)
    tickets_open_last_period       = tickets_currently_open - tickets_created_this_period + tickets_closed_this_period
    roomchecks_this_period         = fetchLSMReport(lsm_period_url_postfix_this)
    roomchecks_last_period         = fetchLSMReport(lsm_period_url_postfix_last)

    latex = latex_template % (
        date_string,
        # Tickets Created                             # Tickets Closed                             # Current Open Tickets                       # False Tickets
        tickets_created_this_period,                  tickets_closed_this_period,                  tickets_currently_open,                      tickets_false_this_period,
        period_string, tickets_created_last_period,   period_string, tickets_closed_last_period,   period_string, tickets_open_last_period, 
        # ---------------------------------------------------------------------------------------------------------------------------------
        # Room Checks Performed                       # Tickets from Room Checks                   # WyoCast / Event Tickets                    # PC Tickets
        roomchecks_this_period,                       tickets_roomchecks_this_period,              tickets_wyocast_this_period,                 tickets_pc_this_period,
        period_string, roomchecks_last_period,
    )

    return latex


# Helper function to fetch TDX report data
def fetchTDXReport(report_id, tdxToken):
    req = urllib.request.Request(
        f"{tdx_base_url}/reports/{report_id}?withData=true", # full url
        headers={"Authorization": f"Bearer {tdxToken}"}
    )

    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))

    if isinstance(data, dict):
        return len(data.get("DataRows", []))

    if isinstance(data, list):
        return len(data)

    return 0


# Helper function to fetch LSM room check numbers
def fetchLSMReport(url_postfix):
    req = urllib.request.Request(
        lsm_base_url + url_postfix, # full url
        headers={"Authorization": f"{lsm_creds}"}
    )

    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode('utf-8'))
        data_json = data.get("data", 0)
        count_total = 0
        for item in data_json:
            count_total += item.get("Count", 0)

    return count_total


# Helper to build bar graph LaTeX code from incoming data
def generateLatexBarGraph(counts, title, max_col):
    items = counts[:max_col]

    # Extract x labels (building codes)
    x_labels = [b for b, c in items]
    symbolic_coords = ",".join(x_labels)

    # Build xtick list
    xticks = ",".join(x_labels)
    coords = " ".join(f"({b},{c})" for b, c in items)

    latex = rf"""
    \pgfplotsset{{width=8.5cm,compat=1.18}}
    \begin{{tikzpicture}}[scale=1.0]
    \begin{{axis}}[
        title={{{title}}},
        ybar,
        enlargelimits=0.15,
        legend style={{at={{(0.5,-0.2)}},
        anchor=north,legend columns=-1}},
        symbolic x coords={{{symbolic_coords}}},
        xtick={{{xticks}}},
        nodes near coords,
        nodes near coords align={{vertical}},
        x tick label style={{rotate=90,anchor=east}},
        x post scale=1.3,
        y post scale=0.65,
    ]
    \addplot[fill=yellow!50!white, draw=yellow!80!black] coordinates {{{coords}}};
    \end{{axis}}
    \end{{tikzpicture}}
    """
    return latex


# Build an ISO 8601 date range for the selected report period.
def buildDateRange(report_period, custom_start=None, custom_end=None):
    now = datetime.now()
    if report_period == 1:
        start = now - timedelta(days=7)
    elif report_period == 2:
        start = now - timedelta(days=30)
    elif report_period == 3:
        start = now - timedelta(days=365)
    elif report_period == 4 and custom_start and custom_end:
        start = custom_start
        now = custom_end
    else:
        start = now - timedelta(days=7)

    return start, now


def formatUTC(dt, end_of_day=False):

    # Convert string -> datetime
    if isinstance(dt, str):
        dt = datetime.strptime(dt, "%m/%d/%Y")

    # Convert date -> datetime
    if isinstance(dt, date) and not isinstance(dt, datetime):
        dt = datetime.combine(
            dt,
            time(23, 59, 59) if end_of_day else time(0, 0, 0)
        )

    # Normalize time
    if isinstance(dt, datetime):
        dt = dt.replace(
            hour=23 if end_of_day else 0,
            minute=59 if end_of_day else 0,
            second=59 if end_of_day else 0,
            microsecond=0
        )

    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


# Helper function to query the TeamDynamix ticket search API.
def fetchTDXSearch(search_payload, tdxToken):
    url = f"{tdx_base_url}/216/tickets/search"
    data = json.dumps(search_payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {tdxToken}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        },
        method="POST"
    )

    with urllib.request.urlopen(req) as response:
        body = response.read().decode("utf-8")
        return json.loads(body)


# Retrieve tickets for the selected period, limited to CTS responsibility group.
def fetchCTSTickets(report_period, tdxToken, custom_start=None, custom_end=None):
    print(f"\t --- Fetching CTS tickets for {['the last week', 'the last month', 'the last year', 'custom date range'][report_period - 1]}...\n")

    start_date, end_date = buildDateRange(report_period, custom_start, custom_end)

    payload = {
        "CreatedDateFrom": formatUTC(start_date),
        "CreatedDateTo": formatUTC(end_date, end_of_day=True),
        "ResponsibilityGroupIDs": [CTS_RESPONSIBILITY_GROUP_ID],
        "MaxResults": 100000,
    }

    tickets = fetchTDXSearch(payload, tdxToken)
    parsed = []
    for ticket in tickets:
        parsed.append({
            "ID": ticket.get("ID"),
            "Title": ticket.get("Title", ""),
            "Created": ticket.get("CreatedDate", ""),
            "RequestorName": ticket.get("RequestorName", ""),
            "ResponsibleFullName": ticket.get("ResponsibleFullName", ""),
            "ResponsibleName": ticket.get("ResponsibleName", ""),
            "ResponsibleGroupName": ticket.get("ResponsibleGroupName", ""),
        })

    return parsed



# --------------------------------- User Input ---------------------------------

print("\n\n\t--- CTS Department Analytics Report Generation ---\n\n")
print("Please ensure you have the following dependencies installed:")
print(" - The 'TeX Live' Distribution")
print(" - The 'pdflatex' Compiler")
print(" - The 'texlive-latex-extra' Package (for specific LaTeX features)")
print(" - pytz (Python package for timezone handling)\n\n")

while True:
    report_period = input("Is this a weekly (1), monthly (2), yearly (3) report, or a custom date range (4)?\n")
    print("")

    report_period = report_period.strip()
    if (report_period in ['1', '2', '3', '4']):
        break
    else:
        print("Invalid input. Please enter 1 for weekly, 2 for monthly, 3 for yearly, or 4 for custom date range.")

report_period = int(report_period)
period_string = {
    1: "Week", 2: "Month", 3: "Year", 4: "Custom"
}.get(report_period, "ERROR")

# Gather custom date range if selected, with validation
custom_start = None
custom_end = None
if report_period == 4:
    while True:
        while True:
            custom_start = input("Enter the start date for the report (MM/DD/YYYY):\n")
            try:
                start_date = datetime.strptime(custom_start.strip(), "%m/%d/%Y")
                break
            except ValueError:
                print("Invalid date format. Please enter valid dates in MM/DD/YYYY format.\n")

        while True:
            custom_end = input("Enter the end date for the report (MM/DD/YYYY):\n")
            try:
                end_date = datetime.strptime(custom_end.strip(), "%m/%d/%Y")
                break
            except ValueError:
                print("Invalid date format. Please enter valid dates in MM/DD/YYYY format.\n")

        if start_date >= end_date:
            print("Start date must be before end date. Please try again.\n")
            continue

        date_string = input("Name this date range? (e.g. 'Semester', 'Bimester', '2 Weeks', etc..., or enter blank line to not name)")

        print(f"\n\n\t-- Custom report period set: {start_date.strftime('%m/%d/%Y')} - {end_date.strftime('%m/%d/%Y')}\n")
        break

print("\n\nAdd up to 5 accomplishment for this period of time")
accomplishments = collectNotes()

print("\n\nAdd up to 5 notes for future")
futureNotes = collectNotes()

print("\n\nAdd up to 5 notes about Tickets and Room Checks")
ticketNotes = collectNotes()

print("\n\n\t --- Processing...\n")



# ------------------------ Aggregation / Data Fetching -------------------------

# Pull TDX & LSM data from .env
env_path = findEnvFile()
if env_path is None:
    print("Error: .env file not found")
    exit(1)

env_absolute_path = os.path.abspath(env_path)
with open(env_absolute_path, "r") as env_file:
    for line in env_file:
        if line.startswith("KEYS_JSON="):
            keys_json = line.split("=", 1)[1].strip().strip("'")
            break

keys = ast.literal_eval(keys_json)
lsm_creds = keys["lsm_api"]
lsm_base_url = "https://uwyo.talem3.com/lsm/api/Leaderboard"
lsm_url_postfix_this_week  = "?offset=0&p=%7BCompletedOn%3A%22last7days%22%7D"
lsm_url_postfix_this_month = "?offset=0&p=%7BCompletedOn%3A%22last30days%22%7D"
lsm_url_postfix_this_year  = "?offset=0&p=%7BCompletedOn%3A%22last90days%22%7D"
lsm_url_postfix_last_week  = "?offset=0&p=%7BCompletedOn%3A%22lastweek%22%7D"
lsm_url_postfix_last_month = "?offset=0&p=%7BCompletedOn%3A%22lastmonth%22%7D"
lsm_url_postfix_last_year  = "?offset=0&p=%7BCompletedOn%3A%22lastyear%22%7D"
tdx_creds = keys["tdx_api_raw"]
tdx_username = tdx_creds["username"]
tdx_password = tdx_creds["password"]
tdx_base_url = "https://uwyo.teamdynamix.com/TDWebApi/api"

# Query for new TDX token (store here locally for simplicity)
auth_url = tdx_base_url + "/auth"
auth_data = json.dumps({"username": tdx_username, "password": tdx_password})
req = urllib.request.Request(
    auth_url, 
    data=auth_data.encode('utf-8'), 
    headers={'Content-Type': 'application/json'}
)
with urllib.request.urlopen(req) as response:
    tdxToken = response.read().decode('utf-8').strip()


# Use the search API for additional CTS analytics results.
try:
    cts_tickets = fetchCTSTickets(report_period, tdxToken, custom_start, custom_end)

    # Create an aggregate count of number of tickets per room
    building_counts = defaultdict(int)
    BUILDING_NORMALIZATION = {
        "BCPA": "PA",
        "ST": "STEM",
        "ENZI": "STEM",
        "ENZI STEM": "STEM",
        "ENG": "EN",
        "ESB": "ES",
        "SIB": "SI",
        "COE": "CL",
        "CIC": "CI",
    }
    for ticket in cts_tickets:
        title = ticket["Title"].strip()

        # Extract only the building abbreviation at the beginning
        match = re.match(r"^([A-Z]+)\b", title)
        if not match:
            continue  # Ignore malformed titles

        building = match.group(1)
        building = BUILDING_NORMALIZATION.get(building, building)
        building_key = building
        building_counts[building_key] += 1

    building_counts = sorted(building_counts.items(), key=lambda x: x[1], reverse=True)

    
    # Divide tickets into time of day buckets (business hours 7am-8pm, and Other)
    time_of_day_counts = [
        ("7am", 0), 
        ("8am", 0), 
        ("9am", 0), 
        ("10am", 0), 
        ("11am", 0), 
        ("12pm", 0), 
        ("1pm", 0), 
        ("2pm", 0), 
        ("3pm", 0), 
        ("4pm", 0), 
        ("5pm", 0), 
        ("6pm", 0), 
        ("7pm", 0), 
        ("Other", 0)
    ]

    denver_tz = pytz.timezone("America/Denver")
    for ticket in cts_tickets:
        created_str = ticket["Created"]
        if not created_str:
            continue

        try:
            created_dt = datetime.strptime(
                created_str,
                "%Y-%m-%dT%H:%M:%S.%fZ"
            )
        except ValueError:
            created_dt = datetime.strptime(
                created_str,
                "%Y-%m-%dT%H:%M:%SZ"
            )

        # Convert to MST using .astimezone() if needed, assuming created_dt is in UTC
        created_dt = pytz.UTC.localize(created_dt)
        created_dt = created_dt.astimezone(denver_tz)
        hour = created_dt.hour

        if 7 <= hour < 20:
            bucket = f"{hour % 12 or 12}{'am' if hour < 12 else 'pm'}"
        else:
            bucket = "Other"

        for i, (label, count) in enumerate(time_of_day_counts):
            if label == bucket:
                time_of_day_counts[i] = (label, count + 1)
                break
except Exception as e:
    print(f"Error fetching CTS ticket search analytics: {e}")



# -------------------------------- Build LaTeX ---------------------------------

print(f"\t --- Building LaTeX...\n")


# Prefix
latex_template = r"""
\documentclass{article}

\title{\textbf{\huge CTS Analytics - %s}}
\author{}
\date{}

\usepackage{pdflscape}
\usepackage{pgfplots}
\usepackage{tikz}
\usepackage{titling}
\usepackage[T1]{fontenc}
\usepackage{helvet}
\renewcommand{\familydefault}{\sfdefault}

\begin{document}
\begin{landscape}
\Large
\setlength{\droptitle}{-5.5cm}
\maketitle

\thispagestyle{empty}

\begin{flushleft}
"""

# Accomplishments/Future Notes Section
if len(accomplishments) > 0:
    latex_template += r"\vspace{0.3cm}"
    latex_template += notesToLatex(accomplishments, r"\LARGE Accomplishments this " + period_string + r":")
if len(futureNotes) > 0:
    latex_template += r"\bigskip"
    latex_template += notesToLatex(futureNotes, r"\LARGE Notes for Next " + period_string + r":")

# New page header
if (len(accomplishments) > 0 or len(futureNotes) > 0):
    latex_template += r"""
    \newpage
    \maketitle
    \thispagestyle{empty}
    """

# Analytics Overview Table
latex_template += r"""
\vspace{-2.25cm}
\begin{center}
 \begin{tabular}{ c|c|c|c } 
  {\small Tickets Created}       & {\small Tickets Closed}           & {\small Current Open Tickets}    & {\small False Tickets}      \\ 
  {\LARGE \textbf{%d}}           & {\LARGE \textbf{%d}}              & {\LARGE \textbf{%d}}             & {\LARGE \textbf{%d}}        \\ 
  {\small Last %s: %d}           & {\small Last %s: %d}              & {\small Last %s: %d}             & {}                          \\
 \hline
  {\small Room Checks Performed} & {\small Tickets from Room Checks} & {\small WyoCast / Event Tickets} & {\small PC Related Tickets} \\ 
  {\LARGE \textbf{%d}}           & {\LARGE \textbf{%d}}              & {\Large \textbf{%d}}             & {\Large \textbf{%d}}        \\ 
  {\small Last %s: %d}           & {}                                & {}                               & {}                          \\ 
 \end{tabular}
\end{center}
"""

# Bar Graphs Section
latex_template += r"""
\begin{figure}[htbp]
    \begin{minipage}{0.48\textwidth}
        \centering
"""
latex_template += generateLatexBarGraph(building_counts, "Ticket Count by Building (Top 10)", 10)
latex_template += r"""
    \end{minipage}
    \hspace{0.33\textwidth}
    \begin{minipage}{0.48\textwidth}
        \centering
"""
latex_template += generateLatexBarGraph(time_of_day_counts, "Ticket Count by Hour", 14)
latex_template += r"""
    \end{minipage}
\end{figure}
"""

# Notes about Overview
if len(ticketNotes) > 0:
    latex_template += r"\vspace{-1.0cm}"
    latex_template += notesToLatex(ticketNotes, r"\large Notes:", "small")

# New page header
currentProjects = [] # TODO: Placeholder for future, use projects API
upcomingProjects = [] # TODO: Placeholder for future, use projects API
if len(currentProjects) > 0 or len(upcomingProjects) > 0:
    latex_template += r"""
    \newpage
    \maketitle
    \thispagestyle{empty}
    """

# Current/Upcoming Projects Section
if len(currentProjects) > 0:
    latex_template += notesToLatex(currentProjects, r"\LARGE Current Projects:")
if len(upcomingProjects) > 0:
    latex_template += r"\bigskip"
    latex_template += notesToLatex(upcomingProjects, r"\LARGE Upcoming Projects:")

# Postfix
latex_template += r"""
\end{flushleft}
\end{landscape}
\end{document}
"""

# Plug in values from TDX reports & other sources
print(f"\t --- Fetching report numbers from external APIs... (this may take a while)\n")
today_date = datetime.now()
tickets_currently_open = fetchTDXReport("260299", tdxToken) # The same regardless of date
match report_period:
    case 1: # 1 Week Period
        past = today_date - timedelta(days=7)
        today_date = today_date.strftime("%m/%d/%Y")
        past_date = past.strftime("%m/%d/%Y")
        date_string = "Week of " + past_date + " - " + today_date

        latex_content = fillCells(
            date_string, "Week", tdxToken, 
            lsm_url_postfix_this_week, lsm_url_postfix_last_week,
            ["260292", "260293", "260284", "260285", "260300", "260305", "260358", "260368"]
        )
    case 2: # 1 Month Period
        past = today_date - timedelta(days=30)
        today_date = today_date.strftime("%m/%d/%Y")
        past_date = past.strftime("%m/%d/%Y")
        date_string = "Month of " + past_date + " - " + today_date

        latex_content = fillCells(
            date_string, "Month", tdxToken, 
            lsm_url_postfix_this_month, lsm_url_postfix_last_month,
            ["260295", "260293", "260287", "260286", "260301", "260306", "260359", "260369"]
        )
    case 3: # 1 Year Period
        past = today_date - timedelta(days=365)
        today_date = today_date.strftime("%m/%d/%Y")
        past_date = past.strftime("%m/%d/%Y")
        date_string = "Year of " + past_date + " - " + today_date

        latex_content = fillCells(
            date_string, "Year", tdxToken, 
            lsm_url_postfix_this_year, lsm_url_postfix_last_year,
            ["260297", "260296", "260290", "260291", "260302", "260307", "260360", "260370"]
        )
    case 4: # Custom Date Period 
        date_string = (date_string + ": ") if len(date_string) > 0 else ""
        date_string += start_date.strftime('%m/%d/%Y') +  " - " + end_date.strftime('%m/%d/%Y')

        # Some API features require that we have 1 week/1 month/1 year periods
        delta_days = (end_date - start_date).days
        if delta_days <= 10:
            latex_content = fillCellsCustom(
                date_string, "Period", tdxToken,
                lsm_url_postfix_this_week, lsm_url_postfix_last_week, 
                start_date, end_date, ["260358", "260368", "260305"]
            )
        elif delta_days <= 45:
            latex_content = fillCellsCustom(
                date_string, "Period", tdxToken,
                lsm_url_postfix_this_month, lsm_url_postfix_last_month, 
                start_date, end_date, ["260359", "260369", "260306"]
            )
        else:
            latex_content = fillCellsCustom(
                date_string, "Period", tdxToken,
                lsm_url_postfix_this_year, lsm_url_postfix_last_year, 
                start_date, end_date, ["260360", "260370", "260307"]
            )
    case _: # Default case (should not happen due to input validation)
        latex_content = latex_template % (
            "ERROR", 
            -1, -1, -1,
            "ERROR",-1, "ERROR", -1, "ERROR", -1, 
            -1, -1, -1,
            "ERROR", -1,
        )



# ----------------------------- Create PDF Report ------------------------------
print(f"\t --- Generating PDF...\n")

today_date = datetime.now().strftime("%Y-%m-%d") # yyyy-mm-dd
period_string = {
    1: "weekly", 2: "monthly", 3: "yearly"
}.get(report_period, "ERROR") # will default to current directory if error
script_dir = os.path.dirname(os.path.abspath(__file__))

# Write filenames with this naming convention: CTS_Analytics_period_yyyy-mm-dd
output_filename = f"CTS_Analytics_{period_string}_{today_date}"
output_filename = "report" # for debugging

# Target directory will be ./weekly, ./monthly, or ./yearly
if period_string != "ERROR" and output_filename != "report":
    target_dir = os.path.join(script_dir, period_string)
    os.chdir(target_dir)

with open(f"{output_filename}.tex", "w") as tex_file:
    tex_file.write(latex_content)

# Generate report and save as PDF
try:
    subprocess.run(
        ["pdflatex", f"{output_filename}.tex"], 
        check=True, capture_output=True
    )
    print("\t --- PDF generated successfully.\n")
    print(f"\t --- Saving PDF as '{output_filename}.pdf' in {"./" + period_string if output_filename != "report" else os.getcwd()}/\n")
except (subprocess.CalledProcessError, FileNotFoundError) as e:
    print(f"\t --- PDF generation failed: {e}. LaTeX source saved as report.tex.\n")

# Remove intermediate files after a short delay to ensure PDF is saved
time.sleep(1)
os.remove(f"{output_filename}.tex")
os.remove(f"{output_filename}.aux")
os.remove(f"{output_filename}.log")
