import csv

room_dict = {}
files = ['roomConfig_M.csv','roomConfig_T.csv','roomConfig_W.csv','roomConfig_R.csv','roomConfig_F.csv',]

for file in files:
    with open(file, 'r') as f:
        reader = csv.reader(f)
        for row in reader:
            schedule = []
            for block in row[1:]:
                if block == '':
                    break
                else:
                    schedule.append(block)
            if row[0] in room_dict.keys():
                for sched in schedule:
                    if not(sched in room_dict[row[0]]):
                        room_dict[row[0]] += schedule
            else:
                room_dict.update({row[0]:schedule})

with open('roomConfig_agg.csv', 'w') as f:
    writer = csv.writer(f, delimiter=',')
    for room in room_dict.keys():
        row = []
        row.append(room)
        row += room_dict[room]
        for _ in range(40-len(row)):
            row.append('')
        writer.writerow(row)
print(room_dict)