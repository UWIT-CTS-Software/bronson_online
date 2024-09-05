import csv, re

def pad(in_string, buff_char, out_len):
    if len(in_string) < out_len:
        return buff_char*(out_len-len(in_string)) + in_string
    else:
        return in_string

with open('F24_raw.csv') as file:
    reader = csv.reader(file, delimiter=',')
    push_vec = []
    for row in reader:
        if re.search("^[A-Z]+\s[0-9]+", row[0]):
            with open('roomConfig_F24.csv', 'a', newline='\n') as write:
                writer = csv.writer(write, delimiter=',')
                for _ in range(12-len(push_vec)):
                    push_vec.append('')
                writer.writerow(push_vec)
            push_vec = []
            split_string = row[0].split(' ')
            proc_string = split_string[0], pad(split_string[1], '0', 4)
            out_string = proc_string[0] + ' ' + proc_string[1]
            push_vec.append(out_string)
        elif re.search("[MTWRF]+\s[0-9]{4}-[0-9]{4}", row[1]):
            search = re.search("[MTWRF]+\s[0-9]{4}-[0-9]{4}", row[1]).group()
            if push_vec.count(search) == 0:
                push_vec.append(search)